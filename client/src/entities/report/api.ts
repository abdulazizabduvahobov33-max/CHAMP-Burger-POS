import { useQuery } from "@tanstack/react-query";

import { api } from "@/shared/lib/api";
import {
  isDateFilterReady,
  type DashboardSummary,
  type DateFilter,
  type IngredientAnalyticsList,
  type IngredientAnalyticsQuery,
  type ProductProfitabilityList,
  type ProductProfitabilityQuery,
  type ProfitStats,
  type SaleDetail,
  type SalesList,
  type TopProduct,
} from "./model";

function dateFilterParams(filter: DateFilter) {
  return {
    preset: filter.preset,
    from: filter.preset === "custom" ? filter.from : undefined,
    to: filter.preset === "custom" ? filter.to : undefined,
  };
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["reports", "dashboard"],
    queryFn: async () => {
      const { data } = await api.get<DashboardSummary>("/reports/dashboard");
      return data;
    },
  });
}

export function useSalesList(filter: DateFilter, search: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: ["reports", "sales", filter, search, page, pageSize],
    queryFn: async () => {
      const { data } = await api.get<SalesList>("/reports/sales", {
        params: { ...dateFilterParams(filter), search: search || undefined, page, pageSize },
      });
      return data;
    },
    enabled: isDateFilterReady(filter),
    placeholderData: (prev) => prev,
  });
}

export function useSaleDetail(id: string | null) {
  return useQuery({
    queryKey: ["reports", "sale", id],
    queryFn: async () => {
      const { data } = await api.get<{ sale: SaleDetail }>(`/reports/sales/${id}`);
      return data.sale;
    },
    enabled: id !== null,
  });
}

export function useTopProducts(filter: DateFilter, limit = 10) {
  return useQuery({
    queryKey: ["reports", "top-products", filter, limit],
    queryFn: async () => {
      const { data } = await api.get<{ items: TopProduct[] }>("/reports/top-products", {
        params: { ...dateFilterParams(filter), limit },
      });
      return data.items;
    },
    enabled: isDateFilterReady(filter),
  });
}

export function useProfitSummary(filter: DateFilter) {
  return useQuery({
    queryKey: ["reports", "profit", filter],
    queryFn: async () => {
      const { data } = await api.get<ProfitStats>("/reports/profit", { params: dateFilterParams(filter) });
      return data;
    },
    enabled: isDateFilterReady(filter),
    placeholderData: (prev) => prev,
  });
}

export function useProductProfitability(filter: DateFilter, query: ProductProfitabilityQuery) {
  return useQuery({
    queryKey: ["reports", "product-profitability", filter, query],
    queryFn: async () => {
      const { data } = await api.get<ProductProfitabilityList>("/reports/product-profitability", {
        params: { ...dateFilterParams(filter), ...query },
      });
      return data;
    },
    enabled: isDateFilterReady(filter),
    placeholderData: (prev) => prev,
  });
}

export function useIngredientAnalytics(filter: DateFilter, query: IngredientAnalyticsQuery) {
  return useQuery({
    queryKey: ["reports", "ingredient-analytics", filter, query],
    queryFn: async () => {
      const { data } = await api.get<IngredientAnalyticsList>("/reports/ingredient-analytics", {
        params: { ...dateFilterParams(filter), ...query },
      });
      return data;
    },
    enabled: isDateFilterReady(filter),
    placeholderData: (prev) => prev,
  });
}
