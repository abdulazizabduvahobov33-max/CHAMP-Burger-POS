import type { NextFunction, Request, Response } from "express";

/** Anything at or above this feels sluggish to a person clicking a button — not a hard SLA,
 * just the threshold worth a log line. Currently expected to fire on nearly every request while
 * the Oregon(backend)↔Frankfurt(Neon) region-latency issue is unresolved — that noise IS the
 * diagnostic signal, not a bug in this middleware. */
const SLOW_REQUEST_MS = 1000;

/** Logs exactly one line for a request that took long enough to notice — deliberately silent
 * otherwise, so this never doubles normal traffic volume in the log stream. Only ever logs
 * method/path/status/duration: never headers, body, query string, or user identity — the SSE
 * stream route (notification.controller.ts) carries its access token as a query param, so path
 * only (`req.path`, not `req.originalUrl`) is what keeps this from ever printing one. */
export function requestTimingLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (durationMs < SLOW_REQUEST_MS) return;
    // eslint-disable-next-line no-console
    console.warn(`⚠️  SLOW REQUEST: ${req.method} ${req.path} ${res.statusCode} ${durationMs.toFixed(0)}ms`);
  });
  next();
}
