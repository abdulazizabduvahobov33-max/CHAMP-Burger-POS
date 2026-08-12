import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import type { Table } from "./model";

const TABLES_KEY = ["tables"] as const;

export function useTables() {
  return useQuery({
    queryKey: TABLES_KEY,
    queryFn: async () => {
      const { data } = await api.get<{ items: Table[] }>("/tables");
      return data.items;
    },
  });
}

// number omitted -> server auto-assigns the next sequential one, so "+ Добавить стол" is a
// single zero-input click.
export function useCreateTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (number?: number) => {
      const { data } = await api.post<{ table: Table }>("/tables", number !== undefined ? { number } : {});
      return data.table;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TABLES_KEY }),
  });
}

export function useUpdateTable(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { number?: number; isActive?: boolean }) => {
      const { data } = await api.patch<{ table: Table }>(`/tables/${id}`, input);
      return data.table;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TABLES_KEY }),
  });
}

export function useDeleteTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tables/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TABLES_KEY }),
  });
}
