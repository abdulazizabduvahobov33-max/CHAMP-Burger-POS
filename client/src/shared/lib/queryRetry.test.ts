import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import { shouldRetryRead } from "./queryRetry";

function responseError(status: number): AxiosError {
  const err = new AxiosError("failed");
  err.response = { status, data: {}, statusText: "", headers: {}, config: err.config! } as AxiosError["response"];
  return err;
}

function noResponseError(code: string): AxiosError {
  return new AxiosError("no response", code);
}

describe("shouldRetryRead — read-query retry policy", () => {
  it("retries a transient network error (no response at all)", () => {
    expect(shouldRetryRead(0, noResponseError("ERR_NETWORK"))).toBe(true);
  });

  it("retries a client-side timeout", () => {
    expect(shouldRetryRead(0, noResponseError("ECONNABORTED"))).toBe(true);
  });

  it("retries a 503 the server answered with (transient backend failure)", () => {
    expect(shouldRetryRead(0, responseError(503))).toBe(true);
  });

  it("does NOT retry a 404 the server definitively answered with", () => {
    expect(shouldRetryRead(0, responseError(404))).toBe(false);
  });

  it("does NOT retry a 422 validation error", () => {
    expect(shouldRetryRead(0, responseError(422))).toBe(false);
  });

  it("does NOT retry a 403 the server definitively answered with", () => {
    expect(shouldRetryRead(0, responseError(403))).toBe(false);
  });

  it("is bounded — stops after 2 failures regardless of error type, never an unbounded retry storm", () => {
    expect(shouldRetryRead(2, noResponseError("ERR_NETWORK"))).toBe(false);
    expect(shouldRetryRead(5, responseError(503))).toBe(false);
  });
});
