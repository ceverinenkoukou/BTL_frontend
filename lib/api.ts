import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from "axios";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8003/api";

// ---------------------------------------------------------------------------
// In-memory GET cache (30 s TTL) — makes page re-visits instant
// ---------------------------------------------------------------------------
const GET_CACHE = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 30_000;

function cacheKey(config: InternalAxiosRequestConfig): string {
  return (config.url ?? "") + (config.params ? JSON.stringify(config.params) : "");
}

/** Call this after mutating data (POST/PATCH/DELETE) to flush related caches. */
export function invalidateCache(urlPrefix?: string) {
  if (!urlPrefix) { GET_CACHE.clear(); return; }
  for (const k of GET_CACHE.keys()) {
    if (k.startsWith(urlPrefix)) GET_CACHE.delete(k);
  }
}

// ---------------------------------------------------------------------------
// Helpers token (localStorage + cookie pour le middleware Next.js)
// ---------------------------------------------------------------------------

export const TOKEN_KEYS = {
  access: "btl_access_token",
  refresh: "btl_refresh_token",
  user: "btl_user",
} as const;

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEYS.access);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEYS.access, access);
  localStorage.setItem(TOKEN_KEYS.refresh, refresh);
  // Cookie lisible par le middleware Next.js (8h = durée du access token)
  document.cookie = `${TOKEN_KEYS.access}=${access}; path=/; max-age=28800; SameSite=Strict`;
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEYS.access);
  localStorage.removeItem(TOKEN_KEYS.refresh);
  localStorage.removeItem(TOKEN_KEYS.user);
  document.cookie = `${TOKEN_KEYS.access}=; path=/; max-age=0`;
}

// ---------------------------------------------------------------------------
// Instance Axios principale
// ---------------------------------------------------------------------------

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// --- Intercepteur requête : injecte le Bearer token + cache GET ---
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if ((config.method ?? "get").toLowerCase() === "get") {
    const key = cacheKey(config);
    const hit = GET_CACHE.get(key);
    if (hit && Date.now() < hit.expires) {
      config.adapter = () =>
        Promise.resolve({
          data: hit.data,
          status: 200,
          statusText: "OK (cached)",
          headers: new AxiosHeaders(),
          config,
        });
    }
  }

  return config;
});

// --- Intercepteur réponse : stocke les GET en cache ---
api.interceptors.response.use((response) => {
  if ((response.config.method ?? "get").toLowerCase() === "get") {
    const key = cacheKey(response.config);
    GET_CACHE.set(key, { data: response.data, expires: Date.now() + CACHE_TTL });
  }
  return response;
});

// --- Intercepteur réponse : refresh automatique sur 401 ---
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      isRefreshing = true;
      const refreshToken =
        typeof window !== "undefined"
          ? localStorage.getItem(TOKEN_KEYS.refresh)
          : null;

      if (!refreshToken) {
        clearTokens();
        if (typeof window !== "undefined")
          window.location.href = "/auth/login";
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh/`, {
          refresh: refreshToken,
        });
        setTokens(data.access, refreshToken);
        processQueue(null, data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        if (typeof window !== "undefined")
          window.location.href = "/auth/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
