import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import { getErrorMessage, isIndeterminateError } from "./errors";

function axiosErrorWithResponse(status: number, body?: unknown): AxiosError {
  const err = new AxiosError("Request failed");
  err.response = { status, data: body, statusText: "", headers: {}, config: err.config! } as AxiosError["response"];
  return err;
}

function axiosErrorNoResponse(code: string): AxiosError {
  const err = new AxiosError("no response", code);
  return err;
}

describe("getErrorMessage", () => {
  it("returns the server's structured message when present", () => {
    const err = axiosErrorWithResponse(422, { error: { message: "Корзина пуста" } });
    expect(getErrorMessage(err)).toBe("Корзина пуста");
  });

  it("maps an axios client-side timeout (ECONNABORTED) to a distinct 'took too long' message, not the generic fallback", () => {
    const err = axiosErrorNoResponse("ECONNABORTED");
    const message = getErrorMessage(err, "Не удалось войти");
    expect(message).not.toBe("Не удалось войти");
    expect(message.length).toBeGreaterThan(0);
  });

  it("maps a network error (ERR_NETWORK) to the network-unavailable message, not the generic fallback", () => {
    const err = axiosErrorNoResponse("ERR_NETWORK");
    const message = getErrorMessage(err, "Не удалось войти");
    expect(message).not.toBe("Не удалось войти");
  });

  it("falls back to the caller-supplied message + status code for an unstructured error response", () => {
    const err = axiosErrorWithResponse(500, { some: "unexpected shape" });
    expect(getErrorMessage(err, "Ошибка")).toBe("Ошибка (500)");
  });

  it("falls back to the caller-supplied message for a non-axios error", () => {
    expect(getErrorMessage(new Error("boom"), "Ошибка")).toBe("Ошибка");
  });
});

describe("isIndeterminateError", () => {
  it("is true for a client-side timeout — the request never got a real answer", () => {
    expect(isIndeterminateError(axiosErrorNoResponse("ECONNABORTED"))).toBe(true);
  });

  it("is true for a network error", () => {
    expect(isIndeterminateError(axiosErrorNoResponse("ERR_NETWORK"))).toBe(true);
  });

  it("is false for a real 4xx/5xx the server DID answer with", () => {
    expect(isIndeterminateError(axiosErrorWithResponse(409, { error: { code: "ALREADY_HANDLED" } }))).toBe(false);
  });

  it("is false for a non-axios error", () => {
    expect(isIndeterminateError(new Error("boom"))).toBe(false);
  });
});
