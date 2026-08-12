import type { Role } from "@/shared/stores/authStore";

/** Mirrors server/src/shared/notifications/notificationBus.ts's NotificationEvent — the wire
 * shape pushed over the SSE stream. `type` is intentionally an open string, not a closed union:
 * new kinds of events (payment confirmations, "call the admin", kitchen-ready pings, ...) are
 * additive on the server and just need an entry in notificationRegistry.ts here to render, never
 * a change to this type or the transport itself. */
export type NotificationEvent = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  roles: Role[];
  data?: Record<string, unknown>;
};

/** The subset of `order.new` events this app currently knows how to act on beyond just showing a
 * toast — payload fields used by the persistent popup card and its Accept/Reject shortcuts. */
export type OrderNotification = NotificationEvent & {
  data: {
    saleId: string;
    sellerId: string;
    sellerName: string | null;
    tableNumber: number | null;
    receiptNumber: string;
    totalAmount: string;
    itemCount: number;
  };
};

export function isOrderNotification(event: NotificationEvent): event is OrderNotification {
  return event.type === "order.new" && typeof event.data?.saleId === "string";
}
