import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import type { Paginated, Product, ProductFormInput, ProductListQuery } from "./model";

const PRODUCTS_KEY = ["products"] as const;

async function fetchProducts(query: ProductListQuery): Promise<Paginated<Product>> {
  const { data } = await api.get<Paginated<Product>>("/products", {
    params: {
      search: query.search || undefined,
      categoryId: query.categoryId || undefined,
      saleType: query.saleType || undefined,
      isActive: query.isActive === undefined ? undefined : String(query.isActive),
      page: query.page,
      pageSize: query.pageSize,
    },
  });
  return data;
}

export function useProducts(query: ProductListQuery) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, query],
    queryFn: () => fetchProducts(query),
    placeholderData: (prev) => prev,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProductFormInput) => {
      const { data } = await api.post<{ product: Product }>("/products", input);
      return data.product;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

type UpdateProductVariables = Partial<ProductFormInput> & { isActive?: boolean };

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProductVariables) => {
      const { data } = await api.patch<{ product: Product }>(`/products/${id}`, input);
      return data.product;
    },
    // The activate/deactivate checkbox is bound directly to server state; without an
    // optimistic patch it visually "snaps back" for the round-trip duration on every toggle.
    onMutate: async (input) => {
      if (input.isActive === undefined) return undefined;

      await queryClient.cancelQueries({ queryKey: PRODUCTS_KEY });
      const previous = queryClient.getQueriesData<Paginated<Product>>({ queryKey: PRODUCTS_KEY });

      queryClient.setQueriesData<Paginated<Product>>({ queryKey: PRODUCTS_KEY }, (old) =>
        old
          ? { ...old, items: old.items.map((p) => (p.id === id ? { ...p, isActive: input.isActive! } : p)) }
          : old,
      );

      return { previous };
    },
    onError: (_err, _input, context) => {
      context?.previous.forEach(([key, value]) => queryClient.setQueryData(key, value));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

// Re-exported under product-specific names for existing call sites — the upload endpoint
// itself is generic (see shared/lib/uploads.ts), not tied to products.
export { uploadImage as uploadProductImage, deleteImage as deleteProductImage } from "@/shared/lib/uploads";
