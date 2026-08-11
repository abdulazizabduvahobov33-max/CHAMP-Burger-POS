import { create } from "zustand";

import type { OrderNotification } from "./model";

type NotificationState = {
  /** Persistent "new order" popup cards — added on `order.new`, removed only when that sale is
   * actually resolved (accepted or rejected), never on a timer. See OrderNotificationStack.tsx. */
  orderNotifications: OrderNotification[];
  pushOrderNotification: (notification: OrderNotification) => void;
  /** Called once a saleId is confirmed handled (accepted/rejected, from any source — the popup's
   * own buttons, the pending panel, or another admin's tab) — the notification bus only signals
   * "something new arrived", pruning is this store's job. */
  resolveOrderNotification: (saleId: string) => void;

  /** The pending-orders queue dialog used to live only inside AdminPosPage; it's now controlled
   * from here so the notification bell (visible on every admin page) can open it too. */
  pendingPanelOpen: boolean;
  setPendingPanelOpen: (open: boolean) => void;
};

export const useNotificationStore = create<NotificationState>((set) => ({
  orderNotifications: [],
  pushOrderNotification: (notification) =>
    set((s) => {
      // A duplicate SSE delivery (a reconnect replaying near the same moment, two tabs) should
      // not stack the same order twice.
      if (s.orderNotifications.some((n) => n.data.saleId === notification.data.saleId)) return s;
      return { orderNotifications: [...s.orderNotifications, notification] };
    }),
  resolveOrderNotification: (saleId) =>
    set((s) => ({ orderNotifications: s.orderNotifications.filter((n) => n.data.saleId !== saleId) })),

  pendingPanelOpen: false,
  setPendingPanelOpen: (open) => set({ pendingPanelOpen: open }),
}));
