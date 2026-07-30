import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

import { useAuthStore, type AuthUser } from "@/shared/stores/authStore";

/** Shared axios instance. Attaches the access token and silently refreshes it on 401. */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    if (!(config.headers instanceof AxiosHeaders)) {
      config.headers = new AxiosHeaders(config.headers);
    }
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;

/**
 * Single-flight refresh: refresh tokens rotate (single-use), so concurrent
 * callers (401-retry interceptor, AuthBootstrap, React 18 StrictMode's
 * double effect invocation in dev) must share one in-flight request instead
 * of each spending the same refresh token — the second caller would get a
 * 401 for an already-revoked token and wipe out the session the first
 * caller just established.
 */
export function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= api
    .post<{ accessToken: string; user: AuthUser }>("/auth/refresh")
    .then(({ data }) => {
      useAuthStore.getState().setSession(data.user, data.accessToken);
      return data.accessToken;
    })
    .catch(() => {
      useAuthStore.getState().clearSession();
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as RetriableConfig | undefined;
    const isAuthEndpoint = original?.url?.includes("/auth/refresh") || original?.url?.includes("/auth/login");

    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        if (!(original.headers instanceof AxiosHeaders)) {
          original.headers = new AxiosHeaders(original.headers);
        }
        original.headers.set("Authorization", `Bearer ${token}`);
        return api(original);
      }
    }

    return Promise.reject(error);
  },
);
