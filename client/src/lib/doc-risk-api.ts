const API_BASE = "https://371kvaeiy5.execute-api.ap-south-1.amazonaws.com/prod";
const TOKEN_KEY = "docRiskToken";

type ApiError = {
  status: number;
  message: string;
};

type UploadUrlResponse = {
  upload_url: string;
  key: string;
  contentType?: string;
};

type UploadUrlsResponse = {
  items: UploadUrlResponse[];
};

type BatchAnalyzeResponse = {
  files: Array<{
    key: string;
    risk_score: number;
    identity?: {
      name?: string;
      dob?: string;
      address?: string;
      confidence?: number;
    };
  }>;
  identity_similarity?: number;
  overall_batch_risk?: number;
  correlation?: {
    conclusion?: string;
    confidence?: number;
    story?: string;
  };
  tokens_used?: number;
  cost_incurred?: number;
};

type BatchSubmitResponse = {
  job_id: string;
  case_id?: string;
  status: string;
};

type BatchJobStatusResponse = {
  job_id: string;
  case_id?: string;
  status: string;
  error?: string;
  prompt1_outputs?: Array<{
    name?: string;
    dob?: string;
    address?: string;
    city?: string;
    state?: string;
    pin?: string;
    AADHAAR?: {
      address_on_doc?: string;
    };
    _input_units?: Array<{
      doc_id?: string;
    }>;
  }>;
  result?: BatchAnalyzeResponse;
  final_verdict?: {
    risk?: string;
    verdict?: string;
    confidence?: number;
    summary?: string;
    per_doc_verdicts?: Array<{
      doc?: string;
      verdict?: string;
      confidence?: number;
      key_flag?: string;
    }>;
  };
  result_summary?: {
    verdict?: string;
    risk?: string;
    confidence?: number;
    summary?: string;
  };
  final_verdict_key?: string;
  current_stage?: string;
  percent_estimate?: number;
};

type FeedbackReaction = {
  filename?: string;
  image_key?: string;
  key?: string;
  job_id?: string;
  scan_time?: string;
  reaction: "like" | "dislike";
};

type FeedbackSubmitResponse = {
  ok: boolean;
  message?: string;
  item?: {
    username?: string;
    feedback?: string;
    reaction_count?: number;
    created_at?: string;
  };
};

type StatsResponse = {
  tokens_used_today: number;
  token_limit_daily: number;
  total_scans: number;
};

type HistoryItem = {
  scan_time: string;
  risk_score?: number;
  summary?: string;
  key?: string;
  job_type?: string;
  files?: Array<{
    key: string;
    risk_score: number;
    identity?: {
      name?: string;
      dob?: string;
      address?: string;
      confidence?: number;
    };
  }>;
  identity_similarity?: number;
  overall_risk?: number;
  correlation?: {
    conclusion?: string;
    confidence?: number;
    story?: string;
  };
};

const authHeader = (token: string | null) =>
  token ? { Authorization: `Bearer ${token}` } : {};

const isAuthErrorMessage = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes("token expired") ||
    lower.includes("invalid token") ||
    lower.includes("missing authorization")
  );
};

const readErrorMessage = async (res: Response) => {
  const text = await res.text().catch(() => "");
  if (!text) return res.statusText || "Request failed";
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
    if (typeof parsed?.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch (error) {
    // ignore JSON parse issues
  }
  return text;
};

const postJson = async <T>(path: string, body: object | null, token?: string | null) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token ?? null),
    },
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw { status: res.status, message } as ApiError;
  }

  const data = (await res.json().catch(() => ({}))) as T;
  if ((data as any)?.error) {
    const message = String((data as any).error || "Request failed");
    throw { status: res.status, message } as ApiError;
  }
  return data;
};

export const getToken = () => window.localStorage.getItem(TOKEN_KEY);

export const setToken = (token: string) => {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event("docRisk:auth"));
};

export const clearToken = () => {
  window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("docRisk:auth"));
};

export const isAuthError = (error: ApiError) =>
  error.status === 401 || isAuthErrorMessage(error.message || "");

export const login = async (username: string, password: string) => {
  const data = await postJson<{ token: string }>("/login", { username, password }, null);
  return data.token;
};

const extFromFile = (file: File) => {
  const name = file.name || "";
  const idx = name.lastIndexOf(".");
  if (idx === -1) return "";
  return name.slice(idx + 1).toLowerCase();
};

export const getUploadUrl = async (token: string, file: File) => {
  const ext = extFromFile(file) || "png";
  return postJson<UploadUrlResponse>(
    "/get-upload-url",
    { ext, contentType: file.type || undefined },
    token
  );
};

export const getUploadUrls = async (token: string, files: File[]) => {
  const payload = {
    files: files.map((file) => ({
      ext: extFromFile(file) || "png",
      contentType: file.type || undefined,
    })),
  };
  return postJson<UploadUrlsResponse>("/get-upload-url", payload, token);
};

export const uploadFile = async (uploadUrl: string, file: File, contentType?: string) => {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType || file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw { status: res.status, message } as ApiError;
  }
};

export const analyzeBatch = async (token: string, files: Array<{ key: string }>) => {
  return postJson<BatchSubmitResponse | BatchAnalyzeResponse>("/batch-analyze", { files }, token);
};

export const submitBatchAnalysis = async (token: string, files: Array<{ key: string }>) => {
  return postJson<BatchSubmitResponse>("/batch-submit", { files }, token);
};

export const fetchBatchJobStatus = async (token: string, jobId: string) => {
  return postJson<BatchJobStatusResponse>("/job-status", { job_id: jobId }, token);
};

export const fetchStats = async (token: string) => {
  return postJson<StatsResponse>("/stats", {}, token);
};

export const submitFeedback = async (
  token: string,
  payload: {
    feedback?: string;
    source?: string;
    page?: string;
    reactions?: FeedbackReaction[];
  }
) => {
  return postJson<FeedbackSubmitResponse>("/feedback", payload, token);
};

export const fetchHistory = async (token: string) => {
  const data = await postJson<HistoryItem[] | { items?: HistoryItem[] } | Record<string, unknown>>(
    "/history",
    {},
    token
  );
  if (Array.isArray(data)) {
    return data;
  }
  const items = (data as { items?: HistoryItem[] }).items;
  if (Array.isArray(items)) {
    return items;
  }
  if (!Array.isArray(data)) {
    throw { status: 500, message: "Invalid history response" } as ApiError;
  }
  return data;
};

export type {
  ApiError,
  StatsResponse,
  HistoryItem,
  BatchAnalyzeResponse,
  BatchSubmitResponse,
  BatchJobStatusResponse,
  FeedbackReaction,
  FeedbackSubmitResponse,
};
