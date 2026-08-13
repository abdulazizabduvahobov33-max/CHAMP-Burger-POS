import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import type { AddSaleItemInput, OwnerSaleDetail, OwnerSalesList, UpdateSaleItemInput } from "./model";

const SALE_DETAIL_KEY = (id: string) => ["owner", "sales", "detail", id] as const;
const SALES_LIST_KEY = ["owner", "sales", "list"] as const;

export function useOwnerSales(page: number, pageSize: number, search: string) {
  return useQuery({
    queryKey: [...SALES_LIST_KEY, page, pageSize, search],
    queryFn: async () => {
      const { data } = await api.get<OwnerSalesList>("/owner/sales", { params: { page, pageSize, search: search || undefined } });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useOwnerSaleDetail(id: string | null) {
  return useQuery({
    queryKey: SALE_DETAIL_KEY(id ?? ""),
    queryFn: async () => {
      const { data } = await api.get<{ sale: OwnerSaleDetail }>(`/owner/sales/${id}`);
      return data.sale;
    },
    enabled: id !== null,
  });
}

// Every correction mutation returns the fresh sale detail straight from the server response, so
// callers can update their view immediately without waiting on a refetch — the list query is
// still invalidated separately since totalAmount/status/itemCount shown there can also change.
function useSaleCorrectionMutation<TInput>(saleId: string, mutationFn: (input: TInput) => Promise<OwnerSaleDetail>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (sale) => {
      queryClient.setQueryData(SALE_DETAIL_KEY(saleId), sale);
      queryClient.invalidateQueries({ queryKey: SALES_LIST_KEY });
    },
  });
}

export function useRemoveSaleItem(saleId: string) {
  return useSaleCorrectionMutation(saleId, async (input: { itemId: string; reason?: string }) => {
    const { data } = await api.post<{ sale: OwnerSaleDetail }>(`/owner/sales/${saleId}/items/${input.itemId}/remove`, {
      reason: input.reason,
    });
    return data.sale;
  });
}

export function useUpdateSaleItem(saleId: string) {
  return useSaleCorrectionMutation(saleId, async (input: { itemId: string } & UpdateSaleItemInput) => {
    const { itemId, ...body } = input;
    const { data } = await api.patch<{ sale: OwnerSaleDetail }>(`/owner/sales/${saleId}/items/${itemId}`, body);
    return data.sale;
  });
}

export function useAddSaleItem(saleId: string) {
  return useSaleCorrectionMutation(saleId, async (input: AddSaleItemInput) => {
    const { data } = await api.post<{ sale: OwnerSaleDetail }>(`/owner/sales/${saleId}/items`, input);
    return data.sale;
  });
}

export function useCancelOwnerSale(saleId: string) {
  return useSaleCorrectionMutation(saleId, async (input: { reason?: string }) => {
    const { data } = await api.post<{ sale: OwnerSaleDetail }>(`/owner/sales/${saleId}/cancel`, input);
    return data.sale;
  });
}
