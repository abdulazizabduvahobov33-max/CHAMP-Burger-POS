import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import type { AcceptSaleInput, CreateSaleInput, MySalesList, PendingSale, Sale } from "./model";

const PENDING_SALES_KEY = ["sales", "pending"] as const;

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
    // This is a live register queue, not a report — a waiter's order should surface without the
    // admin having to manually refresh. Mutations already invalidate it instantly; the interval
    // just covers the gap between two admins/tabs or a slow network round-trip.
    refetchInterval: 8000,
  });
}

export function useAcceptSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: AcceptSaleInput }) => {
      const { data } = await api.post<{ sale: Sale }>(`/sales/${id}/accept`, input);
      return data.sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_SALES_KEY });
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
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
