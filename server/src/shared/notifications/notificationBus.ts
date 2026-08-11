import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { Role } from "@prisma/client";

/**
 * A generic, typed real-time event — not just "new order". `type` is an open string (dot-
 * namespaced, e.g. "order.new", "order.accepted") so new kinds of notifications (payment
 * confirmations, kitchen-ready pings, "call the admin", error alerts, ...) are just another
 * `publish()` call from wherever that event happens — no new transport, no new endpoint, no
 * client-side plumbing beyond registering how that `type` should be presented.
 *
 * `roles` is the delivery filter: the SSE route (notification.controller.ts) only forwards an
 * event to a connected client whose authenticated role is listed here. `data` can carry a
 * `sellerId` (or any other id) for the client to narrow further — e.g. only the seller who sent
 * an order should react to that specific order's "order.accepted" event, even though every
 * SELLER at the location is subscribed to the same location channel.
 */
export type NotificationEvent = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  roles: Role[];
  data?: Record<string, unknown>;
};

/**
 * In-memory pub/sub, one channel per location. Deliberately behind this tiny publish/subscribe
 * interface rather than used directly (Node's EventEmitter) — a single-process deployment (what
 * this app runs today) never needs more, but if this ever runs as multiple server instances
 * behind a load balancer, swapping the internals for a Redis pub/sub channel (or Postgres
 * LISTEN/NOTIFY) is a change to this one file, not to every call site that publishes or every
 * route that subscribes.
 */
class NotificationBus {
  private emitter = new EventEmitter();

  constructor() {
    // Many admin tabs/devices + many sellers can all subscribe to the same location channel —
    // this is expected fan-out, not a leak, so the default-10 warning would just be noise.
    this.emitter.setMaxListeners(0);
  }

  publish(locationId: string, event: NotificationEvent): void {
    this.emitter.emit(locationId, event);
  }

  subscribe(locationId: string, handler: (event: NotificationEvent) => void): () => void {
    this.emitter.on(locationId, handler);
    return () => this.emitter.off(locationId, handler);
  }
}

export const notificationBus = new NotificationBus();

/** Every publish() call already needs a random id — centralized so it's not re-derived at each
 * call site (crypto.randomUUID() everywhere would work too, this just names the intent). */
export function newNotificationId(): string {
  return randomUUID();
}
