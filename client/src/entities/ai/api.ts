import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import type { AiMessage } from "./model";

const AI_KEY = ["ai", "messages"] as const;

export function useAiMessages() {
  return useQuery({
    queryKey: AI_KEY,
    queryFn: async () => {
      const { data } = await api.get<{ messages: AiMessage[] }>("/ai/messages");
      return data.messages;
    },
  });
}

export function useSendAiMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) => {
      const { data } = await api.post<{ userMessage: AiMessage; assistantMessage: AiMessage }>("/ai/messages", { message });
      return data;
    },
    onSuccess: ({ userMessage, assistantMessage }) => {
      queryClient.setQueryData<AiMessage[]>(AI_KEY, (prev) => [...(prev ?? []), userMessage, assistantMessage]);
    },
  });
}

export function useClearAiHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<{ deleted: number }>("/ai/messages");
      return data;
    },
    onSuccess: () => {
      queryClient.setQueryData<AiMessage[]>(AI_KEY, []);
    },
  });
}
