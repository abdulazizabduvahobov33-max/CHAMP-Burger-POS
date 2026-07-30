import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import type { RecipeLine, RecipeLineInput } from "./model";

const recipeKey = (variantId: string) => ["recipes", variantId] as const;

export function useRecipe(variantId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: recipeKey(variantId),
    queryFn: async () => {
      const { data } = await api.get<{ items: RecipeLine[] }>(`/recipes/${variantId}`);
      return data.items;
    },
    enabled: options?.enabled ?? Boolean(variantId),
  });
}

export function useSetRecipe(variantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lines: RecipeLineInput[]) => {
      const { data } = await api.put<{ items: RecipeLine[] }>(`/recipes/${variantId}`, { lines });
      // `variantId` here is captured correctly for this specific call, but React Query
      // re-binds a useMutation hook's *callback* config on every render (`setOptions`),
      // so by the time this promise resolves `onSuccess` below may run with a *different*
      // variantId closure if the caller switched variants while the request was in flight.
      // Returning it alongside the result lets onSuccess target the right cache entry
      // regardless of which render's closure ends up executing.
      return { variantId, items: data.items };
    },
    onSuccess: ({ variantId: savedVariantId, items }) => queryClient.setQueryData(recipeKey(savedVariantId), items),
  });
}
