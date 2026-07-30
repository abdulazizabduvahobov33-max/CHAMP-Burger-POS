import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import type { CreateSaleInput, Sale } from "./model";

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
    },
  });
}
