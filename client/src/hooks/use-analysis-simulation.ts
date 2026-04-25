import { useCallback, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { ToolType, AnalysisResult, KpiStats } from '@shared/schema';
import {
  analyzeBatch as apiAnalyzeBatch,
  fetchBatchJobStatus,
  fetchHistory,
  fetchStats,
  getToken,
  getUploadUrls,
  submitBatchAnalysis,
  uploadFile,
  clearToken,
  isAuthError,
  type ApiError,
  type HistoryItem,
  type StatsResponse,
} from '@/lib/doc-risk-api';
import { toast } from '@/hooks/use-toast';
import { getBasePath } from '@/lib/base-path';

type AnalysisRequest = {
  files: File[];
  toolType: ToolType;
  imageModels?: string[];
};

type ParsedRow = {
  name: string;
  verdict: string;
  score: number | null;
  mediaType: 'image' | 'video' | 'audio' | '';
  sourceKey?: string;
  sourceTool?: string;
};

type BatchMeta = {
  overallRisk?: number;
  identitySimilarity?: number;
  tokensUsed?: number;
  costIncurred?: number;
  verdict?: string;
  risk?: string;
  finalVerdict?: any;
  correlation?: {
    conclusion?: string;
    confidence?: number;
    story?: string;
  };
};

type UploadedDocument = {
  file: File;
  key: string;
};

const DEFAULT_MEDIA_API_BASE = "https://d1hj0828nk37mv.cloudfront.net";
const DEFAULT_MEDIA_API_KEY =
  "key_dcee18935059b2a7.sk_live_qOaXfTpuEpxX2OhRWIaeOLRMq3gBLy7e";
const DEFAULT_MEDIA_API_KEY_HEADER = "x-api-key";
const DEFAULT_DOCUMENT_UPLOAD_URL =
  "https://371kvaeiy5.execute-api.ap-south-1.amazonaws.com/prod/get-upload-url";

const runtimeConfig = (() => {
  const config: Record<string, string> = {};
  const metaUrl = document.querySelector('meta[name="api-url"]') as HTMLMetaElement | null;
  const metaKey = document.querySelector('meta[name="api-key"]') as HTMLMetaElement | null;
  const metaOrigin = document.querySelector('meta[name="origin-verify"]') as HTMLMetaElement | null;
  const metaKeyId = document.querySelector(
    'meta[name="api-key-id"], meta[name="api_key_id"]'
  ) as HTMLMetaElement | null;
  const metaOriginHeader = document.querySelector(
    'meta[name="origin-verify-header"]'
  ) as HTMLMetaElement | null;

  if (metaUrl?.content) config.API_URL = metaUrl.content;
  if (metaKey?.content) config.API_KEY = metaKey.content;
  if (!config.API_KEY && metaKeyId?.content) {
    config.API_KEY = metaKeyId.content;
  }
  if (metaOrigin?.content) config.ORIGIN_VERIFY = metaOrigin.content;
  if (metaOriginHeader?.content) {
    config.ORIGIN_VERIFY_HEADER = metaOriginHeader.content;
  }

  const globalConfig = (window as any).__KYC_CONFIG__ || (window as any).KYC_CONFIG;
  if (globalConfig && typeof globalConfig === 'object') {
    Object.assign(config, globalConfig);
  }

  return config;
})();

const formatBearerKey = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.toLowerCase().startsWith("bearer ") ? raw : `Bearer ${raw}`;
};

const MEDIA_API_BASE = String(
  runtimeConfig.API_URL ||
    runtimeConfig.api_url ||
    runtimeConfig.apiUrl ||
    (window as any).API_URL ||
    (window as any).api_url ||
    DEFAULT_MEDIA_API_BASE
).replace(/\/+$/, "");
const MEDIA_API_KEY_RAW = String(
  runtimeConfig.API_KEY ||
    runtimeConfig.api_key_id ||
    runtimeConfig.apiKeyId ||
    (window as any).API_KEY ||
    (window as any).api_key_id ||
    (window as any).apiKeyId ||
    DEFAULT_MEDIA_API_KEY
);
const MEDIA_API_KEY = formatBearerKey(MEDIA_API_KEY_RAW);
const DOCUMENT_API_URL = DEFAULT_DOCUMENT_UPLOAD_URL.trim();
const DOCUMENT_API_BASE = DOCUMENT_API_URL.replace(/\/get-upload-url\/?$/, "");
const DOCUMENT_API_KEY = "";
const PHASE_MESSAGES = [
  "Analyzing document structure…",
  "Checking text alignment…",
  "Detecting manipulation artifacts…",
  "Validating authenticity signals…",
  "Finalizing risk score…",
];
const DOCUMENT_BATCH_PHASES = {
  uploading: "Uploading…",
  submitting: "Submitting job…",
  queued: "Queued…",
  processing: "Analyzing documents…",
  correlating: "Generating correlation…",
  completed: "Completed.",
} as const;
const MIN_SCAN_DELAY_MS = 4000;
const MAX_SCAN_DELAY_MS = 6000;
const DOCUMENT_BATCH_POLL_INTERVAL_MS = 2500;
const DOCUMENT_BATCH_MAX_POLLS = 40;
const ORIGIN_VERIFY = String(runtimeConfig.ORIGIN_VERIFY || (window as any).ORIGIN_VERIFY || "").trim();
const ORIGIN_VERIFY_HEADER = String(
  runtimeConfig.ORIGIN_VERIFY_HEADER || "x-origin-verify"
).trim();

const buildAuthHeaders = (
  extra: Record<string, string> = {},
  apiKey = MEDIA_API_KEY,
  apiKeyHeader = DEFAULT_MEDIA_API_KEY_HEADER
) => {
  const headers = { ...extra };
  if (apiKey) {
    headers.Authorization = apiKey;
    if (apiKeyHeader) {
      headers[apiKeyHeader] = apiKey;
    }
  }
  if (ORIGIN_VERIFY) headers[ORIGIN_VERIFY_HEADER] = ORIGIN_VERIFY;
  return headers;
};

const resolveBucketFromUploadUrl = (uploadUrl: string) => {
  try {
    const url = new URL(uploadUrl);
    const hostParts = url.hostname.split(".");
    const hostBucket = hostParts[0];
    if (hostBucket && !hostBucket.startsWith("s3")) {
      return hostBucket;
    }
    const pathParts = url.pathname.split("/").filter(Boolean);
    return pathParts[0] || "";
  } catch (error) {
    return "";
  }
};

const requestDocumentPresign = async (file: File) => {
  const payload = {
    filename: file.name || `upload-${Date.now()}.png`,
    contentType: "image/png",
  };
  const res = await fetch(DOCUMENT_API_URL, {
    method: "POST",
    headers: buildAuthHeaders({ "Content-Type": "application/json" }, DOCUMENT_API_KEY),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Presign failed (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();
  const key = data.key ?? data["s3" + "Key"];
  const uploadUrl = data.upload_url ?? data.uploadUrl;
  if (!uploadUrl || !key) {
    throw new Error("Presign response missing upload_url or key");
  }

  return {
    uploadUrl: uploadUrl as string,
    key: key as string,
    contentType: "image/png",
  };
};

const getApiConfig = (toolType: ToolType) => {
  if (toolType === "document") {
    return {
      baseUrl: DOCUMENT_API_BASE,
      presignUrl: DOCUMENT_API_URL,
      apiKey: DOCUMENT_API_KEY,
      apiKeyHeader: DEFAULT_MEDIA_API_KEY_HEADER,
    };
  }
  return {
    baseUrl: MEDIA_API_BASE,
    presignUrl: `${MEDIA_API_BASE.replace(/\/+$/, "")}/uploads/presign`,
    apiKey: MEDIA_API_KEY,
    apiKeyHeader: "",
  };
};

const generateJobId = () => {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `job-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const requestPresign = async (
  file: File,
  jobId: string | undefined,
  presignUrl: string,
  apiKey: string,
  apiKeyHeader: string
) => {
  const filename = file.name || `upload-${Date.now()}.bin`;
  const contentType = file.type || "application/octet-stream";
  const payload: Record<string, string> = { filename, contentType };
  if (jobId) {
    payload.jobId = jobId;
  }

  const res = await fetch(presignUrl, {
    method: "POST",
    headers: buildAuthHeaders({ "Content-Type": "application/json" }, apiKey, apiKeyHeader),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Presign failed (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();
  const s3Key =
    data.s3Key ??
    data.s3_key ??
    data.key ??
    data["s3" + "Key"];
  const uploadUrl = data.uploadUrl ?? data.upload_url ?? data["upload_url"];
  if (!uploadUrl || !s3Key) {
    throw new Error("Presign response missing uploadUrl or s3Key");
  }

  return {
    uploadUrl: uploadUrl as string,
    s3Key: s3Key as string,
    contentType,
    requiredHeaders: (data.requiredHeaders || {}) as Record<string, string>,
  };
};

const uploadToS3 = async (
  file: File,
  uploadUrl: string,
  contentType: string,
  requiredHeaders: Record<string, string> = {}
) => {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      ...requiredHeaders,
    },
    body: file,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${text || res.statusText}`);
  }
};

const uploadMediaList = async (
  files: File[],
  jobId: string | undefined,
  presignUrl: string,
  apiKey: string,
  apiKeyHeader: string
) => {
  const keys: string[] = [];
  for (const file of files) {
    const { uploadUrl, s3Key, contentType, requiredHeaders } = await requestPresign(
      file,
      jobId,
      presignUrl,
      apiKey,
      apiKeyHeader
    );
    await uploadToS3(file, uploadUrl, contentType, requiredHeaders);
    keys.push(s3Key);
  }
  return keys;
};

const submitJob = async (
  userId: string,
  inputs: Record<string, unknown>,
  jobId: string | undefined,
  baseUrl: string,
  apiKey: string,
  apiKeyHeader: string
) => {
  const payload: Record<string, unknown> = { userId: userId || "guest", inputs };
  if (jobId) payload.jobId = jobId;

  const res = await fetch(baseUrl.replace(/\/+$/, "") + "/jobs", {
    method: "POST",
    headers: buildAuthHeaders({ "Content-Type": "application/json" }, apiKey, apiKeyHeader),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Job submission failed (${res.status}): ${(data as any).error || res.statusText}`
    );
  }

  if (!(data as any).jobId) {
    throw new Error("Job submission response missing jobId");
  }

  return data as any;
};

const fetchJob = async (
  jobId: string,
  baseUrl: string,
  apiKey: string,
  apiKeyHeader: string
) => {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const url = `${cleanBase}/jobs/${encodeURIComponent(jobId)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: buildAuthHeaders({ Accept: "application/json" }, apiKey, apiKeyHeader),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch job (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as any;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_DOCUMENT_FILES = 10;

const redirectToLogin = () => {
  window.location.assign(`${getBasePath()}#/login`);
};

const handleAuthFailure = (message?: string) => {
  clearToken();
  toast({
    title: "Session expired",
    description: message || "Please login again.",
  });
  redirectToLogin();
};

const collectFaceMatchFiles = (files: File[]) => {
  const matches: { target?: File; input?: File; swapped?: File } = {};
  files.forEach((file) => {
    const name = file.name.toLowerCase();
    if (name.includes("swapped") || name.includes("swap")) matches.swapped = file;
    if (name.includes("target")) matches.target = file;
    if (name.includes("input")) matches.input = file;
  });

  const ordered: File[] = [];
  if (matches.target) ordered.push(matches.target);
  if (matches.input) ordered.push(matches.input);
  if (matches.swapped) ordered.push(matches.swapped);

  if (ordered.length > 0) return ordered.slice(0, MAX_DOCUMENT_FILES);

  return files.slice(0, MAX_DOCUMENT_FILES);
};

const buildFaceMatchPreviewUrls = (files: File[]) =>
  files.map((file) => URL.createObjectURL(file));

const pollJob = async (
  jobId: string,
  baseUrl: string,
  apiKey: string,
  apiKeyHeader: string,
  maxAttempts = 20,
  intervalMs = 3000
) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const data = await fetchJob(jobId, baseUrl, apiKey, apiKeyHeader);
    const status = String(data.status || "").toUpperCase();
    if (status === "COMPLETED" || status === "FAILED") {
      return data;
    }
    await sleep(intervalMs);
  }
  return fetchJob(jobId, baseUrl, apiKey, apiKeyHeader);
};

const extractFilename = (rawKey: string) => {
  if (!rawKey) return "";
  let s = String(rawKey);
  s = s.split("?")[0];
  const hashIdx = s.lastIndexOf("#");
  if (hashIdx >= 0 && hashIdx < s.length - 1) {
    s = s.slice(hashIdx + 1);
  }
  const slashIdx = s.lastIndexOf("/");
  if (slashIdx >= 0 && slashIdx < s.length - 1) {
    s = s.slice(slashIdx + 1);
  }
  return s.trim();
};

const normalizeFilename = (rawKey: string) => extractFilename(rawKey).toLowerCase();

const filenameForDisplay = (rawKey: string) => {
  const lower = normalizeFilename(rawKey);
  if (!lower) return String(rawKey || "");
  const s = extractFilename(rawKey);
  const dashIdx = s.lastIndexOf("-");
  return dashIdx >= 0 && dashIdx < s.length - 1 ? s.slice(dashIdx + 1) : s;
};

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "avi", "mkv", "webm", "m4v", "flv"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "flac", "ogg", "opus"]);
const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "tiff",
  "tif",
  "heic",
  "heif",
  "jfif",
]);

const mediaTypeFromFilename = (rawKey: string) => {
  const name = extractFilename(rawKey);
  if (!name) return "";
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx === name.length - 1) return "";
  const ext = name.slice(dotIdx + 1).toLowerCase();
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return "";
};

const mediaTypeFromTool = (toolName: string) => {
  const name = String(toolName || "").toLowerCase();
  if (!name) return "";
  if (name.includes("video") || name.includes("liveness")) return "video";
  if (name.includes("audio") || name.includes("voice")) return "audio";
  if (name.includes("image") || name.includes("deepfake") || name.includes("face")) {
    return "image";
  }
  return "";
};

const extractPredictions = (obj: any) => {
  if (!obj || typeof obj !== "object") return null;
  if (
    Array.isArray(obj) &&
    obj.length > 0 &&
    obj.every(
      (item) =>
        item && typeof item === "object" &&
        (typeof item.label === "string" || typeof item.score === "number")
    )
  ) {
    return obj;
  }
  if (Array.isArray(obj.predictions)) return obj.predictions;
  if (obj.outputs && Array.isArray(obj.outputs.predictions)) return obj.outputs.predictions;
  if (obj.data && obj.data.outputs && Array.isArray(obj.data.outputs.predictions)) {
    return obj.data.outputs.predictions;
  }
  if (obj.data && obj.data.data && obj.data.data.outputs && Array.isArray(obj.data.data.outputs.predictions)) {
    return obj.data.data.outputs.predictions;
  }
  return null;
};

const extractIsLive = (obj: any) => {
  if (!obj || typeof obj !== "object") return null;
  if (typeof obj.is_live === "boolean") return obj.is_live;
  if (obj.outputs && typeof obj.outputs.is_live === "boolean") return obj.outputs.is_live;
  if (obj.data && obj.data.outputs && typeof obj.data.outputs.is_live === "boolean") {
    return obj.data.outputs.is_live;
  }
  if (obj.data && obj.data.data && obj.data.data.outputs && typeof obj.data.data.outputs.is_live === "boolean") {
    return obj.data.data.outputs.is_live;
  }
  return null;
};

const extractVerdictAndScore = (value: any) => {
  const scoreFromObject = (obj: any) => {
    if (!obj || typeof obj !== "object") return null;
    for (const key of ["score", "confidence", "probability", "liveness_score"]) {
      if (typeof obj[key] === "number") return obj[key];
    }
    return null;
  };

  const stringFromValue = (val: any): string => {
    if (typeof val === "string") return val.trim();
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    if (Array.isArray(val)) {
      const parts = val.map(stringFromValue).filter(Boolean);
      return parts.length ? parts.join(", ") : "";
    }
    return "";
  };

  const extractLabelFromObject = (obj: any, depth = 0): string => {
    if (!obj || typeof obj !== "object") return "";
    if (depth > 2) return "";
    const keys = [
      "verdict",
      "label",
      "result",
      "status",
      "prediction",
      "pred",
      "class",
      "classification",
      "text",
      "message",
    ];
    for (const key of keys) {
      const text = stringFromValue(obj[key]);
      if (text) return text;
    }
    const nestedKeys = ["output", "outputs", "result", "results", "data", "prediction"];
    for (const key of nestedKeys) {
      const nested = obj[key];
      const direct = stringFromValue(nested);
      if (direct) return direct;
      if (nested && typeof nested === "object") {
        const nestedText = extractLabelFromObject(nested, depth + 1);
        if (nestedText) return nestedText;
      }
    }
    return "";
  };

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    const trimmed = String(value).trim();
    return { verdict: trimmed ? String(value) : "", score: null };
  }
  if (!value || typeof value !== "object") return { verdict: "", score: null as number | null };

  if (typeof value.output === "string") {
    const trimmed = value.output.trim();
    if (trimmed) {
      return { verdict: value.output, score: scoreFromObject(value) };
    }
  }

  const output = value.output && typeof value.output === "object" ? value.output : value;
  const dataBlock = value.data && typeof value.data === "object" ? value.data : null;

  const predictions =
    extractPredictions(output) || extractPredictions(value) || extractPredictions(dataBlock) || [];

  if (predictions.length > 0) {
    let best = predictions[0];
    for (const pred of predictions) {
      if (typeof pred?.score === "number" && pred.score > (best?.score || 0)) {
        best = pred;
      }
    }
    return {
      verdict: best?.label || "",
      score: typeof best?.score === "number" ? best.score : null,
    };
  }

  const isLive = extractIsLive(output) ?? extractIsLive(value) ?? extractIsLive(dataBlock);
  if (typeof isLive === "boolean") {
    return { verdict: isLive ? "pass" : "fail", score: scoreFromObject(output) };
  }

  const label =
    extractLabelFromObject(output) ||
    extractLabelFromObject(value) ||
    extractLabelFromObject(dataBlock);
  if (label) {
    return {
      verdict: label,
      score: scoreFromObject(output) ?? scoreFromObject(value) ?? scoreFromObject(dataBlock),
    };
  }

  return { verdict: "", score: null };
};

const extractSummary = (value: any) => {
  if (!value || typeof value !== "object") return null;
  const candidates = [
    value.summary,
    value.output?.summary,
    value.result?.summary,
    value.data?.summary,
    value.data?.output?.summary,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
};

const resolveResultsPayload = (data: any) => {
  if (!data || typeof data !== "object") return {};
  const candidates = [data.results, data.outputs, data.output];
  if (data.data && typeof data.data === "object") {
    candidates.push(data.data.results, data.data.outputs, data.data.output);
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string") return candidate;
    if (Array.isArray(candidate)) return candidate;
    if (typeof candidate === "object" && Object.keys(candidate).length > 0) return candidate;
  }
  return data.results || data.outputs || data.output || {};
};

const buildRowsFromResults = (results: any, preferredToolType: ToolType | "" = "") => {
  const rows: ParsedRow[] = [];
  if (!results) return rows;

  const entries: Array<{ key: string; value: any }> = Array.isArray(results)
    ? results.map((value, idx) => ({ key: String(idx), value }))
    : results && typeof results === "object"
      ? Object.entries(results).map(([key, value]) => ({ key, value }))
      : [{ key: "result", value: results }];

  for (const { key, value } of entries) {
    const resultValue = value && typeof value === "object" ? value : { output: value };
    const dataAgentType =
      resultValue.data && typeof resultValue.data.agent_type === "string"
        ? resultValue.data.agent_type
        : resultValue.data && resultValue.data.data && typeof resultValue.data.data.agent_type === "string"
          ? resultValue.data.data.agent_type
          : "";
    const sourceTool = String(
      resultValue.tool || resultValue.type || resultValue.agent_type || dataAgentType || ""
    );
    let mediaType =
      mediaTypeFromFilename(key) ||
      mediaTypeFromTool(resultValue.tool) ||
      mediaTypeFromTool(resultValue.type) ||
      mediaTypeFromTool(resultValue.agent_type || "") ||
      mediaTypeFromTool(dataAgentType);

    const displayKey = extractFilename(key) || key;
    if (!mediaType) {
      const lowerKey = String(displayKey).toLowerCase();
      if (lowerKey.includes("video") || lowerKey.includes("liveness")) mediaType = "video";
      if (lowerKey.includes("audio") || lowerKey.includes("voice")) mediaType = "audio";
      if (lowerKey.includes("image")) mediaType = "image";
    }
    if (!mediaType && preferredToolType && preferredToolType !== "document") {
      mediaType = preferredToolType;
    }

    const { verdict, score } = extractVerdictAndScore(resultValue);

    let resolvedVerdict = verdict;
    if (!resolvedVerdict) {
      const rawOutput = resultValue.output ?? resultValue;
      if (typeof rawOutput === "string") {
        resolvedVerdict = rawOutput.trim();
      } else if (typeof rawOutput === "number" || typeof rawOutput === "boolean") {
        resolvedVerdict = String(rawOutput);
      } else if (rawOutput && typeof rawOutput === "object") {
        try {
          resolvedVerdict = JSON.stringify(rawOutput);
        } catch (error) {
          resolvedVerdict = "";
        }
      }
    }

    if (!resolvedVerdict) continue;
    const verdictLower = resolvedVerdict.toLowerCase();
    const isFaceMatch =
      sourceTool.toLowerCase().includes("facematch") ||
      sourceTool.toLowerCase().includes("face match");
    if (verdictLower === "pass" || verdictLower === "fail") {
      if (!mediaType) {
        mediaType =
          preferredToolType && preferredToolType !== "document" ? preferredToolType : "video";
      }
    }

    const baseLabel = filenameForDisplay(displayKey);
    const genericLabels = new Set(["data", "result", "output", "outputs"]);
    const displayLabel =
      (baseLabel && !/^\d+$/.test(baseLabel) && !genericLabels.has(baseLabel.toLowerCase())
        ? baseLabel
        : "") ||
      dataAgentType ||
      resultValue.agent_type ||
      resultValue.type ||
      resultValue.tool ||
      "Result";

    rows.push({
      name: displayLabel,
      verdict: resolvedVerdict,
      score,
      mediaType: (mediaType as ParsedRow['mediaType']) || "",
      sourceKey: String(key),
      sourceTool,
    });
  }

  return rows;
};

const assignSourceKeys = (rows: ParsedRow[], inputs: any) => {
  if (!inputs || typeof inputs !== "object") return rows;
  const images = Array.isArray(inputs.images) ? inputs.images : [];
  const videos = Array.isArray(inputs.video) ? inputs.video : [];
  const audios = Array.isArray(inputs.audio) ? inputs.audio : [];
  let imageIdx = 0;
  let videoIdx = 0;
  let audioIdx = 0;

  return rows.map((row) => {
    if (row.sourceKey && row.sourceKey.trim() && !/^\d+$/.test(row.sourceKey)) {
      return row;
    }
    let sourceKey: string | undefined;
    if (row.mediaType === "image" && imageIdx < images.length) {
      sourceKey = String(images[imageIdx++]);
    } else if (row.mediaType === "video" && videoIdx < videos.length) {
      sourceKey = String(videos[videoIdx++]);
    } else if (row.mediaType === "audio" && audioIdx < audios.length) {
      sourceKey = String(audios[audioIdx++]);
    }
    return sourceKey ? { ...row, sourceKey } : row;
  });
};

const isFaceMatchRow = (row: ParsedRow) => {
  const label = `${row.sourceTool || ""} ${row.name || ""} ${row.sourceKey || ""}`.toLowerCase();
  return label.includes("facematch") || label.includes("face match");
};


const findPreviewFile = (row: ParsedRow, cache: Map<string, File>) => {
  const candidates: string[] = [];
  if (row.name) candidates.push(row.name);
  if (row.sourceKey) {
    candidates.push(extractFilename(row.sourceKey));
    candidates.push(filenameForDisplay(row.sourceKey));
    candidates.push(row.sourceKey);
  }
  for (const candidate of candidates) {
    const key = candidate.trim().toLowerCase();
    if (!key) continue;
    const file = cache.get(key);
    if (file) return file;
  }
  return undefined;
};

const mapVerdictToRisk = (row: ParsedRow) => {
  const verdictLower = row.verdict.toLowerCase();
  if (verdictLower === "fail") return 92;
  if (verdictLower === "pass") return 8;
  if (verdictLower.includes("fake") || verdictLower.includes("not live")) return 92;
  if (verdictLower.includes("real") || verdictLower.includes("live")) return 8;
  if (row.score !== null && typeof row.score === "number") {
    const scorePct = Math.max(0, Math.min(100, row.score * 100));
    return verdictLower === "pass" || verdictLower.includes("real") || verdictLower.includes("live")
      ? Math.round(100 - scorePct)
      : Math.round(scorePct);
  }
  return 50;
};

const mapRiskToDecision = (riskScore: number) => {
  if (riskScore >= 70) return { priority: "CRITICAL", decision: "REJECT" } as const;
  if (riskScore >= 40) return { priority: "MEDIUM", decision: "MANUAL_REVIEW" } as const;
  return { priority: "LOW", decision: "APPROVE" } as const;
};

const riskLabelToScore = (risk?: string) => {
  const normalized = String(risk || "").toUpperCase();
  if (normalized === "CRITICAL") return 95;
  if (normalized === "HIGH") return 85;
  if (normalized === "MEDIUM") return 55;
  if (normalized === "LOW") return 15;
  return 50;
};

const parseApiTimestamp = (value?: string | Date | null) => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const text = String(value).trim();
  if (!text) return new Date();
  const normalized =
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(text) ? text : `${text}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date(text) : parsed;
};

const verdictToRiskScore = (verdict?: string, fallbackRisk?: string) => {
  const normalized = String(verdict || "").toUpperCase();
  if (normalized.includes("LIKELY_FAKE") || normalized.includes("FAKE")) return 88;
  if (normalized.includes("SUSPICIOUS")) return 58;
  if (normalized.includes("INSUFFICIENT")) return 60;
  if (normalized.includes("AUTHENTIC")) return 15;
  return riskLabelToScore(fallbackRisk);
};

const caseDocIdForIndex = (index: number) => `doc_${String(index + 1).padStart(2, "0")}`;

const normalizePrompt1Address = (output: any) => {
  const direct = String(output?.address || "").trim();
  if (direct) return direct;
  const aadhaarAddress = String(output?.AADHAAR?.address_on_doc || "").trim();
  if (aadhaarAddress) return aadhaarAddress;
  const parts = [output?.city, output?.state, output?.pin]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
};

const buildPrompt1IdentityMap = (jobResult: any) => {
  const outputs = Array.isArray(jobResult?.prompt1_outputs)
    ? jobResult.prompt1_outputs
    : Array.isArray(jobResult?.result?.prompt1_outputs)
      ? jobResult.result.prompt1_outputs
      : [];
  const byDocId = new Map<
    string,
    {
      name?: string;
      dob?: string;
      address?: string;
    }
  >();

  outputs.forEach((output: any, index: number) => {
    const identity = {
      name: String(output?.name || "").trim() || undefined,
      dob: String(output?.dob || "").trim() || undefined,
      address: normalizePrompt1Address(output),
    };
    const inputUnits = Array.isArray(output?._input_units) ? output._input_units : [];
    const docIds = Array.from(
      new Set(
        inputUnits
          .map((unit: any) => String(unit?.doc_id || "").trim())
          .filter(Boolean)
      )
    );

    if (docIds.length === 0) {
      docIds.push(caseDocIdForIndex(index));
    }

    docIds.forEach((docId) => {
      byDocId.set(String(docId), identity);
    });
  });

  return byDocId;
};

const buildJobDocumentIdentityMap = (jobResult: any) => {
  const documents = Array.isArray(jobResult?.documents)
    ? jobResult.documents
    : Array.isArray(jobResult?.result?.documents)
      ? jobResult.result.documents
      : [];
  const byDocId = new Map<
    string,
    {
      name?: string;
      dob?: string;
      address?: string;
    }
  >();

  documents.forEach((document: any) => {
    const docId = String(document?.doc_id || "").trim();
    if (!docId) return;
    const identity = {
      name: String(document?.identity?.name || "").trim() || undefined,
      dob: String(document?.identity?.dob || "").trim() || undefined,
      address: String(document?.identity?.address || "").trim() || undefined,
    };
    if (identity.name || identity.dob || identity.address) {
      byDocId.set(docId, identity);
    }
  });

  return byDocId;
};

const buildResultsFromBatchResponse = (
  batchResponse: any,
  keyToFile: Map<string, File>,
  batchId: string,
  now: number,
  nextIdRef: MutableRefObject<number>
) => {
  const files = Array.isArray(batchResponse?.files) ? batchResponse.files : [];
  return files.map((item: any) => {
    const file = keyToFile.get(item.key);
    const riskScore = Math.max(0, Math.min(100, Math.round(item.risk_score || 50)));
    const { priority, decision } = mapRiskToDecision(riskScore);
    const previewUrl = file ? URL.createObjectURL(file) : null;
    return {
      id: nextIdRef.current++,
      filename: file?.name || item.key,
      toolType: "document",
      riskScore,
      priority,
      decision,
      evidence: [`Risk score: ${riskScore}`],
      summary: "Batch analysis completed.",
      batchId,
      storageKey: item.key,
      actionRequired: decision === "MANUAL_REVIEW" ? "Manual Review" : null,
      timestamp: new Date(now),
      previewUrl,
      previewUrls: null,
      identity: item.identity || null,
      metadata: null,
      geolocation: null,
    } satisfies AnalysisResult;
  });
};

const buildResultsFromCaseJob = (
  jobResult: any,
  uploads: UploadedDocument[],
  batchId: string,
  now: number,
  nextIdRef: MutableRefObject<number>
) => {
  const finalVerdict = jobResult?.final_verdict || jobResult?.result?.final_verdict || {};
  const resultSummary = jobResult?.result_summary || {};
  const perDocVerdicts = Array.isArray(finalVerdict?.per_doc_verdicts)
    ? finalVerdict.per_doc_verdicts
    : [];
  const prompt1IdentityByDocId = buildPrompt1IdentityMap(jobResult);
  const documentIdentityByDocId = buildJobDocumentIdentityMap(jobResult);
  const jobDocuments = Array.isArray(jobResult?.documents) ? jobResult.documents : [];
  const overallVerdict = String(finalVerdict?.verdict || resultSummary?.verdict || "");
  const overallRisk = String(finalVerdict?.risk || resultSummary?.risk || "");
  const fallbackRiskScore = verdictToRiskScore(overallVerdict, overallRisk);
  const summary = String(finalVerdict?.summary || resultSummary?.summary || "Case analysis completed.");

  const resolvePerDocVerdict = (docId: string, batchIds: string[], index: number) => {
    const exact = perDocVerdicts.find((item: any) => String(item?.doc || "").trim() === docId);
    if (exact) return exact;

    for (const batchRef of batchIds) {
      const batchMatch = perDocVerdicts.find((item: any) => String(item?.doc || "").trim() === batchRef);
      if (batchMatch) return batchMatch;
    }

    const canUseIndexFallback =
      perDocVerdicts.length === uploads.length &&
      perDocVerdicts.every((item: any) => !String(item?.doc || "").trim());

    return canUseIndexFallback ? perDocVerdicts[index] || {} : {};
  };

  return uploads.map((upload, index) => {
    const docId = caseDocIdForIndex(index);
    const jobDocument =
      jobDocuments.find((item: any) => String(item?.doc_id || "") === docId) || {};
    const batchIds = Array.isArray(jobDocument?.batch_ids)
      ? jobDocument.batch_ids.map((value: any) => String(value))
      : [];
    const docVerdict = resolvePerDocVerdict(docId, batchIds, index);
    const prompt1Identity = prompt1IdentityByDocId.get(docId);
    const documentIdentity = documentIdentityByDocId.get(docId);
    const docRiskScore = docVerdict?.verdict
      ? verdictToRiskScore(String(docVerdict.verdict), overallRisk)
      : fallbackRiskScore;
    const riskScore = Math.max(0, Math.min(100, Math.round(docRiskScore)));
    const { priority, decision } = mapRiskToDecision(riskScore);
    const evidence = [
      docVerdict?.verdict ? `Document verdict: ${docVerdict.verdict}` : `Case verdict: ${overallVerdict || "Completed"}`,
      docVerdict?.key_flag ? `Key flag: ${docVerdict.key_flag}` : "",
      `Risk: ${overallRisk || riskScore}`,
    ].filter(Boolean);

    return {
      id: nextIdRef.current++,
      filename: upload.file.name,
      toolType: "document",
      riskScore,
      priority,
      decision,
      evidence,
      summary,
      batchId,
      storageKey: upload.key,
      actionRequired: decision === "MANUAL_REVIEW" ? "Manual Review" : null,
      timestamp: new Date(now),
      previewUrl: URL.createObjectURL(upload.file),
      previewUrls: null,
      identity:
        finalVerdict?.candidate || documentIdentity || prompt1Identity
          ? {
              name:
                finalVerdict?.candidate?.name ||
                documentIdentity?.name ||
                prompt1Identity?.name ||
                undefined,
              dob:
                finalVerdict?.candidate?.dob ||
                documentIdentity?.dob ||
                prompt1Identity?.dob ||
                undefined,
              address:
                documentIdentity?.address ||
                prompt1Identity?.address ||
                undefined,
              confidence:
                typeof finalVerdict.confidence === "number"
                  ? finalVerdict.confidence / 100
                  : undefined,
            }
          : null,
      metadata: {
        decision,
        evidence,
        docId,
        batchIds,
        sourceType:
          typeof jobDocument?.source_type === "string" ? jobDocument.source_type : undefined,
      },
      geolocation: null,
    } satisfies AnalysisResult;
  });
};

const mapHistoryToResults = (history: HistoryItem[]): AnalysisResult[] => {
  return history.map((item, index) => {
    const riskSource =
      typeof item.overall_risk === "number"
        ? item.overall_risk
        : item.risk
          ? riskLabelToScore(item.risk)
          : typeof item.risk_score === "number"
            ? item.risk_score
            : 0;
    const riskScore = Math.max(0, Math.min(100, Math.round(riskSource)));
    const { priority, decision } = mapRiskToDecision(riskScore);
    const filename = filenameForDisplay(item.key || `scan-${index + 1}`);
    const timestamp = parseApiTimestamp(item.scan_time);

    return {
      id: index + 1,
      filename,
      toolType: "document",
      riskScore,
      priority,
      decision,
      evidence: [`Risk score: ${riskScore}`],
      summary: item.summary || null,
      batchId: item.scan_time || `history-${index + 1}`,
      storageKey: item.key || null,
      actionRequired: decision === "MANUAL_REVIEW" ? "Manual Review" : null,
      timestamp,
      previewUrl: null,
      previewUrls: null,
      metadata: null,
      geolocation: null,
    };
  });
};

const buildFaceMatchEvidence = (imageKeys: string[]) => {
  const names: { target?: string; input?: string; swapped?: string } = {};
  imageKeys.forEach((key) => {
    const lower = normalizeFilename(key);
    if (lower.includes("target")) names.target = key;
    if (lower.includes("input")) names.input = key;
    if (lower.includes("swapped") || lower.includes("swap")) names.swapped = key;
  });
  if (!names.swapped || (!names.target && !names.input)) {
    return null;
  }

  const parts = [
    names.target ? `target: ${filenameForDisplay(names.target)}` : "",
    names.input ? `input: ${filenameForDisplay(names.input)}` : "",
    `swapped: ${filenameForDisplay(names.swapped)}`,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    success: true,
    evidence: [`Face match: Successful (${parts})`],
  };
};

const recomputeStats = (results: AnalysisResult[]): KpiStats => {
  return results.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.decision === "REJECT") acc.rejected += 1;
      if (item.decision === "MANUAL_REVIEW") acc.manual += 1;
      if (item.decision === "APPROVE") acc.approved += 1;
      return acc;
    },
    { total: 0, rejected: 0, manual: 0, approved: 0 }
  );
};

export function useAnalysisSimulation() {
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [stats, setStats] = useState<KpiStats>({ total: 0, rejected: 0, manual: 0, approved: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<StatsResponse | null>(null);
  const [scanDisabled, setScanDisabled] = useState(false);
  const [scanDisabledReason, setScanDisabledReason] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [batchMetaById, setBatchMetaById] = useState<Record<string, BatchMeta>>({});
  const nextIdRef = useRef(1);
  const fileCacheRef = useRef<Map<string, File>>(new Map());
  const originalVideoNamesRef = useRef<Set<string>>(new Set());

  const refreshStats = useCallback(async () => {
    const token = getToken();
    if (!token) {
      handleAuthFailure("Session expired. Please login again.");
      return;
    }
    try {
      const data = await fetchStats(token);
      setUsageStats(data);
      if (data.tokens_used_today >= data.token_limit_daily) {
        setScanDisabled(true);
        setScanDisabledReason("You have reached today’s scan limit.");
      } else {
        setScanDisabled(false);
        setScanDisabledReason(null);
      }
    } catch (error) {
      const err = error as ApiError;
      if (err && isAuthError(err)) {
        handleAuthFailure("Session expired. Please login again.");
        return;
      }
      toast({
        title: "Stats unavailable",
        description: err?.message || "AI service temporarily unavailable.",
      });
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const token = getToken();
    if (!token) {
      handleAuthFailure("Session expired. Please login again.");
      return;
    }
    try {
      const history = await fetchHistory(token);
      setHistoryItems(history);
    } catch (error) {
      const err = error as ApiError;
      if (err && isAuthError(err)) {
        handleAuthFailure("Session expired. Please login again.");
        return;
      }
      toast({
        title: "History unavailable",
        description: err?.message || "AI service temporarily unavailable.",
      });
    }
  }, []);

  const clearHistory = useCallback(() => {
    setHistoryItems([]);
  }, []);

  const runAnalysis = useCallback(async ({ files, toolType, imageModels }: AnalysisRequest) => {
    if (!files || files.length === 0) return;

    setIsAnalyzing(true);
    setToastMessage("submitting");

    try {
      if (toolType === "document") {
        const token = getToken();
        if (!token) {
          handleAuthFailure("Session expired. Please login again.");
          return;
        }

        const batchId = generateJobId();
        const minDelay =
          MIN_SCAN_DELAY_MS +
          Math.random() * (MAX_SCAN_DELAY_MS - MIN_SCAN_DELAY_MS);
        const start = Date.now();
        let phaseIndex = 0;
        setToastMessage(PHASE_MESSAGES[phaseIndex]);

        const phaseTimer = window.setInterval(() => {
          phaseIndex = Math.min(phaseIndex + 1, PHASE_MESSAGES.length - 1);
          setToastMessage(PHASE_MESSAGES[phaseIndex]);
        }, 900);

        const handleFailure = (error: ApiError) => {
          if (error && isAuthError(error)) {
            handleAuthFailure("Session expired. Please login again.");
            return;
          }
          if (error?.status === 403) {
            const message = error.message || "Upload blocked.";
            const lower = message.toLowerCase();
            if (lower.includes("daily token limit")) {
              setScanDisabled(true);
              setScanDisabledReason("You have reached today’s scan limit.");
              toast({ title: "Scan limit reached", description: "You have reached today’s scan limit." });
            } else if (lower.includes("cooldown") || lower.includes("wait before uploading")) {
              toast({ title: "Please wait", description: "Please wait a few seconds before scanning again." });
            } else {
              toast({ title: "Request blocked", description: message });
            }
            return;
          }
          if (error?.status === 429) {
            toast({ title: "Please wait", description: "Please wait a few seconds before scanning again." });
            return;
          }
          if (error?.status === 500) {
            toast({ title: "Upload service unavailable", description: "Upload service temporarily unavailable." });
            return;
          }
          toast({ title: "AI service unavailable", description: error?.message || "AI service temporarily unavailable." });
        };

        try {
          const uploads: UploadedDocument[] = [];
          setToastMessage(DOCUMENT_BATCH_PHASES.uploading);
          const uploadInfos = await getUploadUrls(token, files);
          if (!Array.isArray(uploadInfos.items) || uploadInfos.items.length !== files.length) {
            throw {
              status: 500,
              message: "Upload service returned an incomplete presign response.",
            } as ApiError;
          }

          for (let index = 0; index < files.length; index += 1) {
            const file = files[index];
            const uploadInfo = uploadInfos.items[index];
            await uploadFile(uploadInfo.upload_url, file, uploadInfo.contentType);
            uploads.push({ file, key: uploadInfo.key });
          }

          const keyToFile = new Map(uploads.map((item) => [item.key, item.file]));
          const now = Date.now();
          let newResults: AnalysisResult[] = [];

          setToastMessage(DOCUMENT_BATCH_PHASES.submitting);
          const payload = uploads.map((item) => ({ key: item.key }));
          let submitted: { job_id: string; case_id?: string; status: string } | null = null;
          let directBatchResponse: any = null;

          try {
            submitted = await submitBatchAnalysis(token, payload);
          } catch (error) {
            const err = error as ApiError;
            const isMissingAsyncRoute =
              err?.status === 404 ||
              String(err?.message || "").toLowerCase().includes("unknown route");

            if (!isMissingAsyncRoute) {
              throw err;
            }

            const fallbackResponse = await apiAnalyzeBatch(token, payload);
            if ((fallbackResponse as any)?.job_id) {
              submitted = fallbackResponse as { job_id: string; case_id?: string; status: string };
            } else {
              directBatchResponse = fallbackResponse;
            }
          }

          if (directBatchResponse) {
            newResults = buildResultsFromBatchResponse(
              directBatchResponse,
              keyToFile,
              batchId,
              now,
              nextIdRef
            );

            const meta: BatchMeta = {
              overallRisk: directBatchResponse.overall_batch_risk,
              identitySimilarity: directBatchResponse.identity_similarity,
              tokensUsed: directBatchResponse.tokens_used,
              costIncurred: directBatchResponse.cost_incurred,
              correlation: directBatchResponse.correlation,
            };
            setBatchMetaById((prev) => ({ ...prev, [batchId]: meta }));
          } else if (submitted?.job_id) {
            let jobResult = null as Awaited<ReturnType<typeof fetchBatchJobStatus>> | null;
            for (let attempt = 0; attempt < DOCUMENT_BATCH_MAX_POLLS; attempt += 1) {
              const polled = await fetchBatchJobStatus(token, submitted.job_id);
              const status = String(polled.status || "").toUpperCase();

              if (status === "QUEUED") {
                setToastMessage(DOCUMENT_BATCH_PHASES.queued);
              } else if (
                [
                  "PROCESSING",
                  "PREPARING",
                  "BATCHING",
                  "RUNNING_PROMPT1",
                  "RUN_PROMPT1_BATCH",
                ].includes(status)
              ) {
                setToastMessage(DOCUMENT_BATCH_PHASES.processing);
              } else if (["CONSOLIDATING", "RUNNING_PROMPT2"].includes(status)) {
                setToastMessage(DOCUMENT_BATCH_PHASES.correlating);
              } else if (status === "COMPLETED" || status === "COMPLETED_WITH_WARNINGS") {
                jobResult = polled;
                break;
              } else if (status === "FAILED") {
                throw {
                  status: 500,
                  message: polled.error || "Batch analysis failed.",
                } as ApiError;
              }

              await sleep(DOCUMENT_BATCH_POLL_INTERVAL_MS);
            }

            if (!jobResult?.result && !jobResult?.final_verdict && !jobResult?.result_summary) {
              throw {
                status: 500,
                message: "Batch analysis timed out before completion.",
              } as ApiError;
            }

            if (jobResult.result?.files) {
              newResults = buildResultsFromBatchResponse(
                jobResult.result,
                keyToFile,
                batchId,
                now,
                nextIdRef
              );

              setBatchMetaById((prev) => ({
                ...prev,
                [batchId]: {
                  overallRisk: jobResult.result?.overall_batch_risk,
                  identitySimilarity: jobResult.result?.identity_similarity,
                  tokensUsed: jobResult.result?.tokens_used,
                  costIncurred: jobResult.result?.cost_incurred,
                  correlation: jobResult.result?.correlation,
                },
              }));
            } else {
              newResults = buildResultsFromCaseJob(jobResult, uploads, batchId, now, nextIdRef);

              const finalVerdict = jobResult.final_verdict || jobResult.result?.final_verdict || {};
              const resultSummary = jobResult.result_summary || jobResult.result?.result_summary || {};
              setBatchMetaById((prev) => ({
                ...prev,
                [batchId]: {
                  overallRisk: verdictToRiskScore(
                    finalVerdict.verdict || resultSummary.verdict,
                    finalVerdict.risk || resultSummary.risk
                  ),
                  verdict: finalVerdict.verdict || resultSummary.verdict,
                  risk: finalVerdict.risk || resultSummary.risk,
                  finalVerdict,
                  tokensUsed: (jobResult as any).tokens_used,
                  costIncurred: (jobResult as any).cost_incurred,
                  correlation: {
                    conclusion: finalVerdict.verdict || resultSummary.verdict,
                    confidence: finalVerdict.confidence || resultSummary.confidence,
                    story: finalVerdict.summary || resultSummary.summary,
                  },
                },
              }));
            }
          }

          const elapsed = Date.now() - start;
          if (elapsed < minDelay) {
            await sleep(minDelay - elapsed);
          }

          window.clearInterval(phaseTimer);
          setToastMessage(DOCUMENT_BATCH_PHASES.completed);
          window.setTimeout(() => setToastMessage(null), 1600);

          if (newResults.length > 0) {
            setResults((prev) => {
              const merged = [...newResults.reverse(), ...prev];
              setStats(recomputeStats(merged));
              return merged;
            });
          }

          await refreshStats();
          await loadHistory();
        } catch (error) {
          window.clearInterval(phaseTimer);
          const err = error as ApiError;
          handleFailure(err);
        }

        return;
      }

      const apiConfig = getApiConfig(toolType);
      const jobId = generateJobId();

      const imageFiles: File[] = [];
      const videoFiles: File[] = [];
      const audioFiles: File[] = [];

      files.forEach((file) => {
        if (toolType === 'video') {
          videoFiles.push(file);
          return;
        }
        if (toolType === 'audio') {
          audioFiles.push(file);
          return;
        }
        imageFiles.push(file);
      });

      imageFiles.forEach((file) => fileCacheRef.current.set(file.name.toLowerCase(), file));
      videoFiles.forEach((file) => fileCacheRef.current.set(file.name.toLowerCase(), file));
      audioFiles.forEach((file) => fileCacheRef.current.set(file.name.toLowerCase(), file));
      if (toolType === 'video') {
        originalVideoNamesRef.current = new Set(
          videoFiles.map((file) => normalizeFilename(file.name))
        );
      } else {
        originalVideoNamesRef.current = new Set();
      }

      const [imageKeys, videoKeys, audioKeys] = await Promise.all([
        uploadMediaList(
          imageFiles,
          jobId,
          apiConfig.presignUrl,
          apiConfig.apiKey,
          apiConfig.apiKeyHeader
        ),
        uploadMediaList(
          videoFiles,
          jobId,
          apiConfig.presignUrl,
          apiConfig.apiKey,
          apiConfig.apiKeyHeader
        ),
        uploadMediaList(
          audioFiles,
          jobId,
          apiConfig.presignUrl,
          apiConfig.apiKey,
          apiConfig.apiKeyHeader
        ),
      ]);
      const cacheByKey = (keys: string[], files: File[]) => {
        keys.forEach((key, idx) => {
          const file = files[idx];
          if (!file) return;
          const lowerKey = String(key).toLowerCase();
          if (lowerKey) fileCacheRef.current.set(lowerKey, file);
          const extracted = extractFilename(key).toLowerCase();
          if (extracted) fileCacheRef.current.set(extracted, file);
          const displayName = filenameForDisplay(key).toLowerCase();
          if (displayName) fileCacheRef.current.set(displayName, file);
        });
      };
      cacheByKey(imageKeys, imageFiles);
      cacheByKey(videoKeys, videoFiles);
      cacheByKey(audioKeys, audioFiles);

      const inputs: Record<string, unknown> = {
        images: imageKeys,
        video: videoKeys,
        audio: audioKeys,
      };

      if (toolType === 'image' && imageModels && imageModels.length > 0) {
        inputs.imageModels = imageModels;
      }

      const jobInfo = await submitJob(
        "demo_user",
        inputs,
        jobId,
        apiConfig.baseUrl,
        apiConfig.apiKey,
        apiConfig.apiKeyHeader
      );
      setToastMessage("submitted");

      const jobData = await pollJob(
        jobInfo.jobId || jobId,
        apiConfig.baseUrl,
        apiConfig.apiKey,
        apiConfig.apiKeyHeader
      );
      setToastMessage("success");

      const resultsPayload = resolveResultsPayload(jobData);
      const rawRows = buildRowsFromResults(resultsPayload, toolType);
      const mergedRows = rawRows.length === 0
        ? buildRowsFromResults(jobData, toolType)
        : rawRows;
      const inputPayload = jobInfo.inputs || jobData.inputs || jobData.metadata || {};
      const rows = assignSourceKeys(mergedRows, inputPayload);
      const finalRows = rows;

      const wantsFaceMatchOnly =
        toolType === 'image' &&
        imageModels &&
        imageModels.includes('image-facematch') &&
        !imageModels.includes('image-deepfake');
      const faceMatchInfo =
        toolType === 'image' && imageModels && imageModels.includes('image-facematch')
          ? buildFaceMatchEvidence(imageKeys)
          : null;
      const faceMatchPreviewUrls =
        toolType === 'image' && imageModels && imageModels.includes('image-facematch')
          ? buildFaceMatchPreviewUrls(collectFaceMatchFiles(imageFiles))
          : undefined;

      const now = Date.now();
      let effectiveRows = finalRows;
      if (wantsFaceMatchOnly) {
        const faceRows = finalRows.filter(isFaceMatchRow);
        effectiveRows = faceRows.length ? faceRows : finalRows;
      }
      if (faceMatchInfo) {
        effectiveRows = effectiveRows.filter((row) => !isFaceMatchRow(row));
        if (wantsFaceMatchOnly) {
          effectiveRows = [];
        }
      }
      const newResults: AnalysisResult[] = effectiveRows.map((row) => {
        const previewFile = findPreviewFile(row, fileCacheRef.current);
        const verdictLower = row.verdict.toLowerCase();
        const displayVerdict =
          row.mediaType === 'video' && (verdictLower === 'pass' || verdictLower === 'fail')
            ? verdictLower === 'pass'
              ? 'Live'
              : 'Not Live'
            : row.verdict;
        const riskScore = mapVerdictToRisk(row);
        const { priority, decision } = mapRiskToDecision(riskScore);
        const isRowFaceMatch = isFaceMatchRow(row);
        const previewUrl = previewFile ? URL.createObjectURL(previewFile) : null;
        const previewUrls =
          isRowFaceMatch && faceMatchPreviewUrls && faceMatchPreviewUrls.length > 0
            ? faceMatchPreviewUrls
            : null;
        const resolvedToolType = (row.mediaType || toolType) as ToolType;
        return {
          id: nextIdRef.current++,
          filename: row.name,
          toolType: resolvedToolType,
          riskScore,
          priority,
          decision,
          evidence: [displayVerdict],
          summary: null,
          actionRequired: decision === "MANUAL_REVIEW" ? "Manual Review" : null,
          timestamp: new Date(now),
          previewUrl,
          previewUrls,
          metadata: null,
          geolocation: null,
        };
      });

      if (faceMatchInfo) {
        const faceMatchScore = 5;
        const faceMatchDecision = mapRiskToDecision(faceMatchScore);
        newResults.push({
          id: nextIdRef.current++,
          filename: "Face Match",
          toolType: "image",
          riskScore: faceMatchScore,
          priority: faceMatchDecision.priority,
          decision: faceMatchDecision.decision,
          evidence: faceMatchInfo.evidence,
          summary: null,
          actionRequired: null,
          timestamp: new Date(now),
          previewUrl: null,
          previewUrls: faceMatchPreviewUrls ?? null,
          metadata: null,
          geolocation: null,
        });
      }

      setResults((prev) => {
        const merged = [...newResults, ...prev];
        setStats(recomputeStats(merged));
        return merged;
      });
    } catch (_error: any) {
      setToastMessage("failed");
      console.error("Analysis request failed");
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const updateDecisionLocal = useCallback(
    (
      resultId: number | string,
      decision: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW'
    ) => {
      const normalizedId = String(resultId);
      setResults((prev) => {
        const updated = prev.map((item) =>
          String(item.id) === normalizedId ? { ...item, decision } : item
        );
        setStats(recomputeStats(updated));
        return updated;
      });
    },
    []
  );

  const updateDecision = useCallback((id: number, decision: AnalysisResult['decision']) => {
    setResults((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, decision } : item
      );
      setStats(recomputeStats(updated));
      return updated;
    });
  }, []);

  return {
    isAnalyzing,
    results,
    stats,
    toastMessage,
    runAnalysis,
    updateDecision,
    updateDecisionLocal,
    refreshStats,
    loadHistory,
    usageStats,
    scanDisabled,
    scanDisabledReason,
    historyItems,
    clearHistory,
    batchMetaById,
  };
}
