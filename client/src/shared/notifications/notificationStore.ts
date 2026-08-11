import { create } from "zustand";

import type { OrderNotification } from "./model";
import { playOrderChime } from "./sound";

// A new order that nobody's looked at yet is exactly the thing that must not get lost in a busy
// room — repeating the chime a few times if it's still sitting unhandled is cheap insurance
// against "I didn't hear it the first time". 2 repeats (3 chimes total, including the first one
// pushOrderNotification already triggers via the SSE handler) stops well short of annoying.
const REPEAT_INTERVAL_MS = 18_000;
const MAX_REPEATS = 2;

// Deliberately NOT part of the Zustand state — these are side-effect handles (setTimeout ids),
// not data any component renders from. Keyed by saleId so resolving one order can cancel exactly
// its own pending repeats without touching any other still-unhandled order's timers.
const repeatTimers = new Map<string, number>();

function clearRepeatTimer(saleId: string) {
  const handle = repeatTimers.get(saleId);
  if (handle !== undefined) {
    window.clearTimeout(handle);
    repeatTimers.delete(saleId);
  }
}

function scheduleRepeat(saleId: string, remaining: number) {
  if (remaining <= 0) return;
  clearRepeatTimer(saleId);
  const handle = window.setTimeout(() => {
    // Re-check membership at fire time, not just at schedule time — the order may have been
    // accepted/rejected in the interim, which already called clearRepeatTimer, but a second
    // belt-and-suspenders check here costs nothing and guards against any future call path that
    // forgets to.
    const stillPending = useNotificationStore.getState().orderNotifications.some((n) => n.data.saleId === saleId);
    if (!stillPending) return;
    playOrderChime();
    scheduleRepeat(saleId, remaining - 1);
  }, REPEAT_INTERVAL_MS);
  repeatTimers.set(saleId, handle);
}

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
  pushOrderNotification: (notification) => {
    let added = false;
    set((s) => {
      // A duplicate SSE delivery (a reconnect replaying near the same moment, two tabs) should
      // not stack the same order twice — or restart its repeat countdown.
      if (s.orderNotifications.some((n) => n.data.saleId === notification.data.saleId)) return s;
      added = true;
      return { orderNotifications: [...s.orderNotifications, notification] };
    });
    if (added) scheduleRepeat(notification.data.saleId, MAX_REPEATS);
  },
  resolveOrderNotification: (saleId) => {
    clearRepeatTimer(saleId);
    set((s) => ({ orderNotifications: s.orderNotifications.filter((n) => n.data.saleId !== saleId) }));
  },

  pendingPanelOpen: false,
  setPendingPanelOpen: (open) => set({ pendingPanelOpen: open }),
}));
