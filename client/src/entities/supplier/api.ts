import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import type { Supplier, SupplierFormInput } from "./model";

const SUPPLIERS_KEY = ["suppliers"] as const;

export function useSuppliers() {
  return useQuery({
    queryKey: SUPPLIERS_KEY,
    queryFn: async () => {
      const { data } = await api.get<{ items: Supplier[] }>("/suppliers");
      return data.items;
    },
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SupplierFormInput) => {
      const { data } = await api.post<{ supplier: Supplier }>("/suppliers", input);
      return data.supplier;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUPPLIERS_KEY }),
  });
}

export function useUpdateSupplier(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SupplierFormInput) => {
      const { data } = await api.patch<{ supplier: Supplier }>(`/suppliers/${id}`, input);
      return data.supplier;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUPPLIERS_KEY }),
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/suppliers/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUPPLIERS_KEY }),
  });
}
