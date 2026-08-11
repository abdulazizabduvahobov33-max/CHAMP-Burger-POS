import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import { useNotificationStore } from "@/shared/notifications/notificationStore";
import type { AcceptSaleInput, CreateSaleInput, MySalesList, PendingSale, Sale } from "./model";

export const PENDING_SALES_KEY = ["sales", "pending"] as const;

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSaleInput) => {
      const { data } = await api.post<{ sale: Sale }>("/sales", input);
      return data.sale;
    },
    onSuccess: (sale) => {
      // A sale deducts ingredient stock server-side — keep Warehouse/recipe views fresh. A
      // still-PENDING sale (SELLER/waiter checkout) doesn't touch stock yet, but invalidating
      // unconditionally is harmless (a no-op refetch) and keeps this simple.
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      // The seller's own history list should show a just-sent/completed sale immediately.
      queryClient.invalidateQueries({ queryKey: ["sales", "mine"] });
      // A SUPER_ADMIN's own checkout ("Оформление заказа") auto-accepts and never shows up in
      // the pending queue, but a SELLER's "Отправить заказ" does — refresh it either way so an
      // admin watching the queue sees a new order the moment it's sent.
      if (sale.status === "PENDING") {
        queryClient.invalidateQueries({ queryKey: PENDING_SALES_KEY });
      }
    },
  });
}

/** Admin-only: every seller's not-yet-accepted order at this location, oldest first — the "new
 * orders" queue behind the "Оформление заказа" section's pending-orders view. */
export function usePendingSales() {
  return useQuery({
    queryKey: PENDING_SALES_KEY,
    queryFn: async () => {
      const { data } = await api.get<{ items: PendingSale[] }>("/sales/pending");
      return data.items;
    },
    // No refetchInterval — this used to poll every 8s, but the notification stream
    // (shared/notifications/useNotificationStream.ts) now invalidates this query the instant an
    // order.new/accepted/rejected event arrives over SSE, so a timed poll would only ever be
    // late compared to the push, never earlier. See docs on why: real-time push, not refresh.
  });
}

export function useAcceptSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: AcceptSaleInput }) => {
      const { data } = await api.post<{ sale: Sale }>(`/sales/${id}/accept`, input);
      return data.sale;
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: PENDING_SALES_KEY });
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      // Don't wait for the SSE echo of this exact action to clear its own popup card — the
      // notification stream still handles every OTHER tab/admin.
      useNotificationStore.getState().resolveOrderNotification(sale.id);
    },
  });
}

export function useRejectSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<{ sale: Sale }>(`/sales/${id}/reject`);
      return data.sale;
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: PENDING_SALES_KEY });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      useNotificationStore.getState().resolveOrderNotification(sale.id);
    },
  });
}

/** The calling seller's own order history — see sale.service.ts's listMySales for why this is
 * always scoped to "my sales" regardless of role, unlike the admin-only /reports/sales list. */
export function useMySales(page: number, pageSize: number) {
  return useQuery({
    queryKey: ["sales", "mine", page, pageSize],
    queryFn: async () => {
      const { data } = await api.get<MySalesList>("/sales", { params: { page, pageSize } });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useMySaleDetail(id: string | null) {
  return useQuery({
    queryKey: ["sales", "mine", "detail", id],
    queryFn: async () => {
      const { data } = await api.get<{ sale: Sale }>(`/sales/${id}`);
      return data.sale;
    },
    enabled: id !== null,
  });
}
