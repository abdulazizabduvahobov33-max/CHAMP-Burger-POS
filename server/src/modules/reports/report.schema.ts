import { z } from "zod";

import { withDateRange } from "../../shared/utils/dateRange.js";

export const salesListQuerySchema = withDateRange({
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const topProductsQuerySchema = withDateRange({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const profitSummaryQuerySchema = withDateRange({});

export const productProfitabilityQuerySchema = withDateRange({
  sortBy: z.enum(["quantity", "revenue", "cost", "profit", "margin"]).default("profit"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Ingredient consumption is a slower-moving, review-style report (like Purchases) — a month
// window is more useful as a default than "today", where most ingredients would show no data.
export const ingredientAnalyticsQuerySchema = withDateRange(
  {
    sortBy: z.enum(["consumption", "cost", "quantity", "forecastDays"]).default("consumption"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  },
  "month",
);

export type SalesListQuery = z.infer<typeof salesListQuerySchema>;
export type TopProductsQuery = z.infer<typeof topProductsQuerySchema>;
export type ProfitSummaryQuery = z.infer<typeof profitSummaryQuerySchema>;
export type ProductProfitabilityQuery = z.infer<typeof productProfitabilityQuerySchema>;
export type IngredientAnalyticsQuery = z.infer<typeof ingredientAnalyticsQuerySchema>;
