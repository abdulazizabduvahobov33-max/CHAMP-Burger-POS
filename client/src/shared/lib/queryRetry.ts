import { AxiosError } from "axios";

/**
 * A 4xx the server DID answer with (validation, not found, forbidden, ...) is deterministic —
 * retrying sends the exact same request into the exact same wall. Only worth retrying when the
 * request never got a real answer at all (network drop, client-side timeout) or the server
 * itself reported a transient failure (5xx) — a sleeping/just-restarted backend, a Neon cold
 * connection, a proxy hiccup. Mutations are NOT covered by this (see app/providers.tsx, which
 * only applies it to `queries`) — TanStack Query's own default for mutations is retry:false, and
 * this app relies on that: a write must never be silently retried by a generic policy unless its
 * OWN idempotency is verified (see PosCart.tsx's clientRequestId for the one place that's
 * actually been done).
 */
export function shouldRetryRead(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false; // bounded — never an unbounded retry storm
  if (error instanceof AxiosError && error.response) {
    return error.response.status >= 500;
  }
  return true; // no response at all: network error or client-side timeout — worth one more try
}
