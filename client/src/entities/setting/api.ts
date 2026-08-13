import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import type { ReceiptSettings, SettingsResponse, SystemInfo, UpdateSettingsInput } from "./model";

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

/** The narrow, SELLER-readable slice of company settings a printed receipt needs — see
 * server/src/modules/settings/settings.service.ts's getReceiptSettings() for why this is a
 * separate endpoint from useSettings() above (which is SUPER_ADMIN-only). */
export function useReceiptSettings() {
  return useQuery({
    queryKey: ["receipt-info"],
    queryFn: async () => {
      const { data } = await api.get<{ settings: ReceiptSettings }>("/receipt-info");
      return data.settings;
    },
    staleTime: 5 * 60 * 1000,
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
