import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

import { requestTimingLogger } from "./requestTiming.js";

function makeRes(statusCode: number) {
  const res = new EventEmitter() as EventEmitter & { statusCode: number };
  res.statusCode = statusCode;
  return res;
}

describe("requestTimingLogger", () => {
  it("stays silent for a fast request", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = { method: "GET", path: "/api/health" } as never;
    const res = makeRes(200);
    const next = vi.fn();

    requestTimingLogger(req, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    res.emit("finish");

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("logs method/path/status/duration for a slow request, and never the query string", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // A real EventSource connection carries its access token as a query param
    // (?token=...) — this must never end up in the log line.
    const req = { method: "GET", path: "/api/notifications/stream", originalUrl: "/api/notifications/stream?token=secret-value" } as never;
    const res = makeRes(200);

    // 1500ms apart (start, then finish) — well over the slow-request threshold.
    const bigintSpy = vi
      .spyOn(process.hrtime, "bigint")
      .mockReturnValueOnce(0n)
      .mockReturnValueOnce(1_500_000_000n);

    requestTimingLogger(req, res as never, vi.fn());
    res.emit("finish");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [line] = warnSpy.mock.calls[0] as [string];
    expect(line).toContain("GET");
    expect(line).toContain("/api/notifications/stream");
    expect(line).toContain("200");
    expect(line).not.toContain("secret-value");
    expect(line).not.toContain("token=");

    warnSpy.mockRestore();
    bigintSpy.mockRestore();
  });
});
