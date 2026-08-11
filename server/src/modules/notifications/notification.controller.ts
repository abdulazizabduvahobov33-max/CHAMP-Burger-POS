import type { Request, Response } from "express";

import { verifyAccessToken } from "../../shared/utils/jwt.js";
import { notificationBus, type NotificationEvent } from "../../shared/notifications/notificationBus.js";

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream — one long-lived HTTP response per connected tab/device, pushed to
 * the instant something publishes on this location's channel (see notificationBus.ts). Chosen
 * over WebSockets because every notification so far is server → client only; SSE gets automatic
 * reconnect semantics, works over plain HTTP/1.1, and needs no extra dependency.
 *
 * Auth can't go through the normal `authenticate` middleware: the browser's native EventSource
 * API has no way to attach an `Authorization` header, so the access token travels as a query
 * param instead — the one deliberate exception to this app's "bearer header only" rule. Access
 * tokens are short-lived (see JWT_ACCESS_EXPIRES) and this is a read-only, per-connection check,
 * not a rewrite of how auth works everywhere else.
 */
export async function stream(req: Request, res: Response) {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  let auth: ReturnType<typeof verifyAccessToken>;
  try {
    auth = verifyAccessToken(token);
  } catch {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Недействительный или истёкший токен" } });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Nginx-style reverse proxies buffer proxied responses by default, which would hold every
  // event until the buffer fills instead of flushing it immediately — harmless on Render's own
  // proxy today, but a one-line insurance policy against ever sitting behind one that does.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: NotificationEvent) => {
    if (!event.roles.includes(auth.role)) return;
    res.write(`event: notification\ndata: ${JSON.stringify(event)}\n\n`);
  };

  const unsubscribe = notificationBus.subscribe(auth.locationId, send);

  // Idle connections get silently dropped by most proxies/load balancers after 30-60s — a
  // comment-line ping (ignored by EventSource, invisible to app code) keeps this one alive
  // indefinitely without ever surfacing as a fake notification.
  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}
