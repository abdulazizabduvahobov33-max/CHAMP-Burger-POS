import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { PENDING_SALES_KEY } from "@/entities/sale/api";
import i18n from "@/shared/i18n";
import { baseURL } from "@/shared/lib/api";
import { useAuthStore } from "@/shared/stores/authStore";
import { toast } from "@/shared/stores/toastStore";
import { isOrderNotification, type NotificationEvent } from "./model";
import { useNotificationStore } from "./notificationStore";
import { playOrderChime } from "./sound";

const INITIAL_RETRY_MS = 2000;
const MAX_RETRY_MS = 30_000;

function readString(data: Record<string, unknown> | undefined, key: string): string | null {
  const value = data?.[key];
  return typeof value === "string" ? value : null;
}

function handleEvent(event: NotificationEvent, queryClient: QueryClient) {
  switch (event.type) {
    case "order.new": {
      // The badge count and the pending-orders panel both read this query — invalidating it is
      // what actually keeps them correct; the popup card and chime below are just the "look at
      // this now" layer on top.
      void queryClient.invalidateQueries({ queryKey: PENDING_SALES_KEY });
      if (isOrderNotification(event)) {
        useNotificationStore.getState().pushOrderNotification(event);
      }
      playOrderChime();
      return;
    }
    case "order.accepted":
    case "order.rejected": {
      const saleId = readString(event.data, "saleId");
      const sellerId = readString(event.data, "sellerId");
      const receiptNumber = readString(event.data, "receiptNumber") ?? "";
      if (saleId) useNotificationStore.getState().resolveOrderNotification(saleId);
      void queryClient.invalidateQueries({ queryKey: PENDING_SALES_KEY });

      // Only the seller who actually sent this particular order should hear about its outcome —
      // every SELLER at the location shares one channel (see notificationBus.ts), so this filter
      // is what keeps a busy location from paging every waiter about every order.
      if (sellerId && sellerId === useAuthStore.getState().user?.id) {
        void queryClient.invalidateQueries({ queryKey: ["sales", "mine"] });
        if (event.type === "order.accepted") {
          toast.success(i18n.t("notifications.toast.orderAccepted", { number: receiptNumber }));
        } else {
          toast.error(i18n.t("notifications.toast.orderRejected", { number: receiptNumber }));
        }
      }
      return;
    }
    default:
      // Unknown/future event type — nothing in this build knows how to react to it yet. Not an
      // error: this is exactly the "add a new type on the server, older clients ignore it
      // gracefully" case the whole design is meant to allow.
      return;
  }
}

/**
 * Mounted once at the app root (see App.tsx) — not per-page — so a cashier hears the chime and
 * sees the popup no matter which admin page they're on. Opens one Server-Sent Events connection
 * for the whole app lifetime, reconnecting with backoff on drop; see
 * server/src/modules/notifications/notification.controller.ts for the other end.
 */
export function useNotificationStream(): void {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  // Read fresh inside the SSE callback without making the connection effect below depend on
  // (and tear down/reopen for) every queryClient identity change — there is only ever one
  // QueryClient instance in this app, but this keeps the effect's own dependency list honest.
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;

    let es: EventSource | null = null;
    let retryTimer: number | undefined;
    let attempt = 0;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const token = useAuthStore.getState().accessToken;
      if (!token) return;

      const url = `${baseURL}/notifications/stream?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);

      es.addEventListener("notification", ((raw: MessageEvent<string>) => {
        attempt = 0;
        try {
          handleEvent(JSON.parse(raw.data) as NotificationEvent, queryClientRef.current);
        } catch {
          // Malformed payload — drop it rather than take down the whole stream over one bad event.
        }
      }) as EventListener);

      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;
        // Deliberately NOT triggering a refresh here (tried it, reverted it — see git history):
        // firing refreshAccessToken() from this handler races the single-use refresh cookie
        // against page navigation. A drop caused by unmounting mid-navigation (this exact
        // handler running while the browser is already tearing the page down) can get the
        // resulting request cancelled client-side *after* the server already rotated the
        // token — the client never sees the new cookie, and the next real page load's own
        // refresh 401s on the now-orphaned one. connect() below already re-reads whatever
        // token is currently in the store, which normal API traffic (axios's own 401 retry)
        // keeps fresh on its own — this loop doesn't need to also manage that.
        attempt += 1;
        const delay = Math.min(MAX_RETRY_MS, INITIAL_RETRY_MS * 2 ** (attempt - 1));
        retryTimer = window.setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      es?.close();
    };
  }, [status, userId]);
}
