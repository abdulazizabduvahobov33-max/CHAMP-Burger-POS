import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import type { CreateSaleInput, MySalesList, Sale } from "./model";

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSaleInput) => {
      const { data } = await api.post<{ sale: Sale }>("/sales", input);
      return data.sale;
    },
    onSuccess: () => {
      // A sale deducts ingredient stock server-side — keep Warehouse/recipe views fresh.
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      // The seller's own history list should show a just-completed sale immediately.
      queryClient.invalidateQueries({ queryKey: ["sales", "mine"] });
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
