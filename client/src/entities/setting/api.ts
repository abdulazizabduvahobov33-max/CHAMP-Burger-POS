import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import type { ClearDataSummary, SettingsResponse, SystemInfo, UpdateSettingsInput } from "./model";

const SETTINGS_KEY = ["settings"] as const;

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => {
      const { data } = await api.get<SettingsResponse>("/settings");
      return data;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateSettingsInput) => {
      const { data } = await api.patch<{ settings: SettingsResponse["settings"] }>("/settings", input);
      return data.settings;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

export function useSystemInfo() {
  return useQuery({
    queryKey: ["settings", "system-info"],
    queryFn: async () => {
      const { data } = await api.get<SystemInfo>("/settings/system-info");
      return data;
    },
  });
}

export function useClearData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ summary: ClearDataSummary }>("/settings/clear-data", { confirm: true });
      return data.summary;
    },
    // Wipes sales/purchases/stock movements — every screen that reads them needs to refetch,
    // not just the settings page itself (Reports, Profit, Warehouse stock levels, ...).
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
