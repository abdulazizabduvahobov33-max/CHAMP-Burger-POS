import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import type {
  BulkRestockInput,
  Ingredient,
  IngredientFormInput,
  IngredientListQuery,
  Paginated,
  StockAmountInput,
  StockMovement,
} from "./model";

const INGREDIENTS_KEY = ["ingredients"] as const;
const movementsKey = (id: string) => ["ingredients", id, "movements"] as const;

async function fetchIngredients(query: IngredientListQuery): Promise<Paginated<Ingredient>> {
  const { data } = await api.get<Paginated<Ingredient>>("/ingredients", {
    params: {
      search: query.search || undefined,
      unit: query.unit || undefined,
      lowStock: query.lowStock ? "true" : undefined,
      page: query.page,
      pageSize: query.pageSize,
    },
  });
  return data;
}

export function useIngredients(query: IngredientListQuery) {
  return useQuery({
    queryKey: [...INGREDIENTS_KEY, query],
    queryFn: () => fetchIngredients(query),
    placeholderData: (prev) => prev,
  });
}

export function useIngredientMovements(
  ingredientId: string,
  page: number,
  options?: Pick<UseQueryOptions<Paginated<StockMovement>>, "enabled">,
) {
  return useQuery({
    queryKey: [...movementsKey(ingredientId), page],
    queryFn: async () => {
      const { data } = await api.get<Paginated<StockMovement>>(`/ingredients/${ingredientId}/movements`, {
        params: { page, pageSize: 10 },
      });
      return data;
    },
    enabled: options?.enabled ?? true,
    placeholderData: (prev) => prev,
  });
}

export function useCreateIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: IngredientFormInput) => {
      const { data } = await api.post<{ ingredient: Ingredient }>("/ingredients", input);
      return data.ingredient;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INGREDIENTS_KEY }),
  });
}

export function useUpdateIngredient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: IngredientFormInput) => {
      const { data } = await api.patch<{ ingredient: Ingredient }>(`/ingredients/${id}`, input);
      return data.ingredient;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INGREDIENTS_KEY }),
  });
}

export function useDeleteIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/ingredients/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INGREDIENTS_KEY }),
  });
}

export function useRestockIngredient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StockAmountInput) => {
      const { data } = await api.post<{ ingredient: Ingredient }>(`/ingredients/${id}/restock`, input);
      return data.ingredient;
    },
    // Derive the id from the resolved ingredient rather than closing over the hook argument —
    // React Query re-binds a useMutation hook's callbacks on every render, so if the dialog
    // this hook lives in stays mounted across ingredients (not remounted via a `key`), a
    // stale `id` closure could invalidate the wrong ingredient's cache entry (same fix as
    // useSetRecipe in entities/recipe/api.ts).
    onSuccess: (ingredient) => {
      queryClient.invalidateQueries({ queryKey: INGREDIENTS_KEY });
      queryClient.invalidateQueries({ queryKey: movementsKey(ingredient.id) });
    },
  });
}

export function useBulkRestockIngredients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BulkRestockInput) => {
      const { data } = await api.post<{ count: number }>("/ingredients/bulk-restock", input);
      return data;
    },
    // Invalidating the ["ingredients"] prefix also catches every mounted ["ingredients", id,
    // "movements"] query (TanStack Query matches by key prefix), same as the single-item
    // restock/write-off mutations above.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INGREDIENTS_KEY }),
  });
}

export function useWriteOffIngredient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StockAmountInput) => {
      const { data } = await api.post<{ ingredient: Ingredient }>(`/ingredients/${id}/write-off`, input);
      return data.ingredient;
    },
    onSuccess: (ingredient) => {
      queryClient.invalidateQueries({ queryKey: INGREDIENTS_KEY });
      queryClient.invalidateQueries({ queryKey: movementsKey(ingredient.id) });
    },
  });
}
