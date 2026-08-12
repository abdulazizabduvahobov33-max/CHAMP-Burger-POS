import type { Unit } from "@/entities/ingredient/model";
import type { SaleType } from "@/entities/product/model";

export type DatePreset = "today" | "yesterday" | "week" | "month" | "custom";

// Values are i18n keys (see entities/ingredient/model.ts's UNIT_LABELS for why).
export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: "report.datePreset.today",
  yesterday: "report.datePreset.yesterday",
  week: "report.datePreset.week",
  month: "report.datePreset.month",
  custom: "report.datePreset.custom",
};

export const DATE_PRESET_OPTIONS: DatePreset[] = ["today", "yesterday", "week", "month", "custom"];

export type DateFilter = {
  preset: DatePreset;
  from?: string;
  to?: string;
};

/** "Период" isn't a usable filter until both endpoints are picked — callers should hold off
 * querying (and the UI should say so) rather than firing a request that the server will 422. */
export function isDateFilterReady(filter: DateFilter): boolean {
  return filter.preset !== "custom" || Boolean(filter.from && filter.to);
}

export type PeriodStat = {
  revenue: string;
  count: number;
  profit: string;
};

export type DashboardSummary = {
  today: PeriodStat;
  week: PeriodStat;
  month: PeriodStat;
  totalRevenue: string;
  receiptCount: number;
  averageReceipt: string;
  totalCost: string;
  totalProfit: string;
  profitMargin: string;
};

export type ProfitStats = {
  revenue: string;
  cost: string;
  profit: string;
  margin: string;
  receiptCount: number;
  averageProfit: string;
};

export type ProductProfitabilitySort = "quantity" | "revenue" | "cost" | "profit" | "margin";

export type ProductProfitability = {
  variantId: string;
  productName: string;
  variantLabel: string;
  saleType: SaleType;
  quantitySold: string;
  revenue: string;
  cost: string;
  profit: string;
  margin: string;
  hasCostData: boolean;
};

export type ProductProfitabilityQuery = {
  sortBy: ProductProfitabilitySort;
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
};

export type IngredientAnalyticsSort = "consumption" | "cost" | "quantity" | "forecastDays";

export type IngredientAnalyticsRow = {
  id: string;
  name: string;
  unit: Unit;
  quantity: string;
  consumed: string;
  cost: string;
  forecastDays: string | null;
};

export type IngredientAnalyticsQuery = {
  sortBy: IngredientAnalyticsSort;
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
};

export type SaleListItem = {
  id: string;
  receiptNumber: string;
  createdAt: string;
  sellerName: string;
  itemCount: number;
  totalAmount: string;
};

export type SalesListSummary = {
  revenue: string;
  count: number;
  average: string;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type SalesList = Paginated<SaleListItem> & { summary: SalesListSummary };

export type SaleDetailItem = {
  id: string;
  productName: string;
  variantLabel: string;
  saleType: SaleType;
  quantity: string;
  unitPrice: string;
  subtotal: string;
  cost: string;
  profit: string;
  hasCostData: boolean;
};

export type SaleDetail = {
  id: string;
  receiptNumber: string;
  createdAt: string;
  sellerName: string;
  totalAmount: string;
  totalCost: string;
  totalProfit: string;
  items: SaleDetailItem[];
};

export type ProductProfitabilityList = Paginated<ProductProfitability>;
export type IngredientAnalyticsList = Paginated<IngredientAnalyticsRow>;

export type TopProduct = {
  variantId: string;
  productName: string;
  variantLabel: string;
  saleType: SaleType;
  quantitySold: string;
  revenue: string;
};
