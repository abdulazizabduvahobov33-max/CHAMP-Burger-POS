import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import { isDateFilterReady, type DateFilter } from "@/entities/report/model";
import type { CreatePurchaseInput, PurchaseDetail, PurchasesList } from "./model";

const PURCHASES_KEY = ["purchases"] as const;

function dateFilterParams(filter: DateFilter) {
  return {
    preset: filter.preset,
    from: filter.preset === "custom" ? filter.from : undefined,
    to: filter.preset === "custom" ? filter.to : undefined,
  };
}

export function usePurchases(filter: DateFilter, search: string, supplierId: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: [...PURCHASES_KEY, filter, search, supplierId, page, pageSize],
    queryFn: async () => {
      const { data } = await api.get<PurchasesList>("/purchases", {
        params: { ...dateFilterParams(filter), search: search || undefined, supplierId: supplierId || undefined, page, pageSize },
      });
      return data;
    },
    enabled: isDateFilterReady(filter),
    placeholderData: (prev) => prev,
  });
}

export function usePurchase(id: string | null) {
  return useQuery({
    queryKey: [...PURCHASES_KEY, "detail", id],
    queryFn: async () => {
      const { data } = await api.get<{ purchase: PurchaseDetail }>(`/purchases/${id}`);
      return data.purchase;
    },
    enabled: id !== null,
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePurchaseInput) => {
      const { data } = await api.post<{ purchase: PurchaseDetail }>("/purchases", input);
      return data.purchase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PURCHASES_KEY });
      // A purchase adds stock and updates ingredient cost fields server-side — keep
      // Warehouse/recipe views fresh (same reasoning as useCreateSale invalidating this key).
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
    },
  });
}
