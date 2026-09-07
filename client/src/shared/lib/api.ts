import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

import { useAuthStore, type AuthUser } from "@/shared/stores/authStore";

// Exported (not just a local const) so anything that can't go through the axios instance itself
// — the SSE stream in shared/notifications, which needs a plain URL string for `new
// EventSource(...)` — still resolves the backend origin the exact same way, split-host deploys
// included, instead of re-deriving it.
export const baseURL = import.meta.env.VITE_API_URL ?? "/api";

// A relative "/api" is only correct when something (nginx, a platform rewrite) proxies it to
// the backend on this SAME domain. On a split-host deploy (a static frontend + a separate
// backend service — e.g. Render) that's never the case: VITE_API_URL must be the backend's
// full URL, baked in at BUILD time (Vite inlines import.meta.env.* — setting the env var after
// the fact and just restarting does nothing, the site has to be rebuilt). Silently falling
// back to "/api" here previously showed up only as a generic "login failed" with no clue why —
// this warning is the whole diagnosis in one line, visible in the browser console with zero
// extra steps.
if (import.meta.env.PROD && baseURL === "/api") {
  // eslint-disable-next-line no-console
  console.warn(
    `[Sharof KFS] VITE_API_URL was not set at build time — API requests will go to ${window.location.origin}/api ` +
      "(this page's own origin). If the backend runs on a different domain, set VITE_API_URL to its full URL " +
      "and rebuild the frontend.",
  );
}

// No request should be able to hang indefinitely — without this, a sleeping Render backend or a
// genuinely stuck connection shows the user a spinner that never resolves (the browser's own
// default is effectively "forever" for XHR/fetch). 20s comfortably covers a WARM backend's
// slowest real request; it's deliberately NOT sized to cover a full ~60s Render cold start —
// see AuthBootstrap.tsx, which gives its own one bootstrap-time request a separately configured
// longer budget instead of raising this default for every request in the app.
const DEFAULT_TIMEOUT_MS = 20_000;

/** Shared axios instance. Attaches the access token and silently refreshes it on 401. */
export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: DEFAULT_TIMEOUT_MS,
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
 *
 * `timeoutMs` lets ONE caller (AuthBootstrap, on first app load) opt into a much longer budget
 * to ride out a Render free-tier cold start, without raising DEFAULT_TIMEOUT_MS for every other
 * request in the app. Ignored if a refresh is already in flight (the in-flight call's own
 * timeout wins) — single-flight means there's only ever one real request to configure anyway.
 */
export function refreshAccessToken(timeoutMs?: number): Promise<string | null> {
  refreshPromise ??= api
    .post<{ accessToken: string; user: AuthUser }>("/auth/refresh", undefined, timeoutMs ? { timeout: timeoutMs } : undefined)
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
