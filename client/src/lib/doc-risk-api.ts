const API_BASE = "https://371kvaeiy5.execute-api.ap-south-1.amazonaws.com/prod";
const TOKEN_KEY = "docRiskToken";

type ApiError = {
  status: number;
  message: string;
};

type UploadUrlResponse = {
  upload_url: string;
  key: string;
};

type AnalyzeResponse = {
  risk_score: number;
  summary?: string;
};

type StatsResponse = {
  tokens_used_today: number;
  token_limit_daily: number;
  total_scans: number;
};

type HistoryItem = {
  scan_time: string;
  risk_score: number;
  summary?: string;
  key: string;
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

export const getUploadUrl = async (token: string) => {
  return postJson<UploadUrlResponse>("/get-upload-url", {}, token);
};

export const uploadFile = async (uploadUrl: string, file: File) => {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "image/png",
    },
    body: file,
  });
  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw { status: res.status, message } as ApiError;
  }
};

export const analyzeDocument = async (token: string, bucket: string, key: string) => {
  return postJson<AnalyzeResponse>("/analyze", { bucket, key }, token);
};

export const fetchStats = async (token: string) => {
  return postJson<StatsResponse>("/stats", {}, token);
};

export const fetchHistory = async (token: string) => {
  const data = await postJson<HistoryItem[] | Record<string, unknown>>(
    "/history",
    {},
    token
  );
  if (!Array.isArray(data)) {
    throw { status: 500, message: "Invalid history response" } as ApiError;
  }
  return data;
};

export type { ApiError, StatsResponse, HistoryItem, AnalyzeResponse };
