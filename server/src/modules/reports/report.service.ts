import { Prisma } from "@prisma/client";

import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/error.js";
import { resolveDateRange } from "../../shared/utils/dateRange.js";
import { shortReceiptNumber } from "../../shared/utils/receiptNumber.js";
import { computeProfitStats, getVariantCostMap, unitCostOf, ZERO } from "./report.costing.js";
import type {
  IngredientAnalyticsQuery,
  ProductProfitabilityQuery,
  ProfitSummaryQuery,
  SalesListQuery,
  TopProductsQuery,
} from "./report.schema.js";

function average(revenue: Prisma.Decimal, count: number): string {
  return count > 0 ? revenue.div(count).toString() : "0";
}

/**
 * The three "always visible" reference cards (today/week/month) plus lifetime totals — now
 * including profit alongside revenue (Module 9). Each period's revenue/count AND cost/profit/
 * margin come from ONE `computeProfitStats` call (report.costing.ts), which itself issues one
 * `aggregate` + one `groupBy`; four periods run in parallel via `Promise.all`, mirroring this
 * function's original all-parallel shape rather than fetching each period sequentially.
 * This is intentionally NOT parameterized by the page's active filter; the filter drives
 * `listSales`/`getTopProducts`/`getProfitSummary` below instead (see report.controller.ts).
 */
export async function getDashboardSummary(locationId: string) {
  const today = resolveDateRange("today");
  const week = resolveDateRange("week");
  const month = resolveDateRange("month");

  const [todayStats, weekStats, monthStats, allTimeStats] = await Promise.all([
    computeProfitStats(locationId, today.start, today.end),
    computeProfitStats(locationId, week.start, week.end),
    computeProfitStats(locationId, month.start, month.end),
    computeProfitStats(locationId),
  ]);

  return {
    today: { revenue: todayStats.revenue, count: todayStats.receiptCount, profit: todayStats.profit },
    week: { revenue: weekStats.revenue, count: weekStats.receiptCount, profit: weekStats.profit },
    month: { revenue: monthStats.revenue, count: monthStats.receiptCount, profit: monthStats.profit },
    totalRevenue: allTimeStats.revenue,
    receiptCount: allTimeStats.receiptCount,
    averageReceipt: average(new Prisma.Decimal(allTimeStats.revenue), allTimeStats.receiptCount),
    totalCost: allTimeStats.cost,
    totalProfit: allTimeStats.profit,
    profitMargin: allTimeStats.margin,
  };
}

/**
 * Paginated sales list for the given date range, plus an aggregate summary (revenue/count/
 * average) over that SAME filtered where-clause — one extra `aggregate` call instead of a
 * second round-trip from the client. `_count: { items: true }` gets the line-item count
 * without ever fetching the SaleItem rows themselves.
 */
export async function listSales(locationId: string, query: SalesListQuery) {
  const range = resolveDateRange(query.preset, query.from, query.to);

  const where: Prisma.SaleWhereInput = {
    locationId,
    createdAt: { gte: range.start, lte: range.end },
    ...(query.search ? { seller: { name: { contains: query.search, mode: "insensitive" } } } : {}),
  };

  const [sales, total, summary] = await Promise.all([
    prisma.sale.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        totalAmount: true,
        seller: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.sale.count({ where }),
    prisma.sale.aggregate({ where, _sum: { totalAmount: true }, _count: { _all: true } }),
  ]);

  const summaryRevenue = summary._sum.totalAmount ?? ZERO;

  return {
    items: sales.map((s) => ({
      id: s.id,
      receiptNumber: shortReceiptNumber(s.id),
      createdAt: s.createdAt,
      sellerName: s.seller.name,
      itemCount: s._count.items,
      totalAmount: s.totalAmount.toString(),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    summary: {
      revenue: summaryRevenue.toString(),
      count: summary._count._all,
      average: average(summaryRevenue, summary._count._all),
    },
  };
}

export async function getSaleDetail(locationId: string, id: string) {
  const sale = await prisma.sale.findFirst({
    where: { id, locationId },
    include: {
      seller: { select: { name: true } },
      items: { include: { variant: { include: { product: true } } } },
    },
  });

  if (!sale) {
    throw new AppError(404, "NOT_FOUND", "Продажа не найдена");
  }

  // Per-item cost/profit (Module 9) — one batched cost lookup for every distinct variant in
  // this sale, not one query per line.
  const costMap = await getVariantCostMap(sale.items.map((item) => item.variantId));

  let totalCost = ZERO;
  const items = sale.items.map((item) => {
    const cost = unitCostOf(costMap, item.variantId).mul(item.quantity);
    const profit = item.subtotal.sub(cost);
    totalCost = totalCost.add(cost);
    return {
      id: item.id,
      productName: item.variant.product.name,
      variantLabel: item.variant.label,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      subtotal: item.subtotal.toString(),
      cost: cost.toString(),
      profit: profit.toString(),
      // A variant with no recipe configured (e.g. Kefsi today) prices at cost=0, which would
      // otherwise misleadingly read as "100% margin" — flag it so the UI can show "—" instead.
      hasCostData: costMap.has(item.variantId),
    };
  });

  const totalProfit = sale.totalAmount.sub(totalCost);

  return {
    id: sale.id,
    receiptNumber: shortReceiptNumber(sale.id),
    createdAt: sale.createdAt,
    sellerName: sale.seller.name,
    totalAmount: sale.totalAmount.toString(),
    totalCost: totalCost.toString(),
    totalProfit: totalProfit.toString(),
    items,
  };
}

/**
 * Ranks variants by units sold in the given range via `groupBy` — a genuine aggregating
 * query (SUM + GROUP BY in Postgres), not "fetch everything and count in JS". Only the
 * winning `limit` variantIds are then resolved to product/label — never the underlying
 * SaleItem rows.
 */
export async function getTopProducts(locationId: string, query: TopProductsQuery) {
  const range = resolveDateRange(query.preset, query.from, query.to);

  const grouped = await prisma.saleItem.groupBy({
    by: ["variantId"],
    where: { sale: { locationId, createdAt: { gte: range.start, lte: range.end } } },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: query.limit,
  });

  if (grouped.length === 0) return [];

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: grouped.map((g) => g.variantId) } },
    include: { product: true },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  return grouped.map((g) => {
    const variant = variantMap.get(g.variantId);
    return {
      variantId: g.variantId,
      productName: variant?.product.name ?? "—",
      variantLabel: variant?.label ?? "—",
      quantitySold: (g._sum.quantity ?? ZERO).toString(),
      revenue: (g._sum.subtotal ?? ZERO).toString(),
    };
  });
}

/** Profit for an arbitrary caller-selected period — the "Период" case the fixed dashboard
 * cards above don't cover. Thin wrapper around the same `computeProfitStats` primitive. */
export async function getProfitSummary(locationId: string, query: ProfitSummaryQuery) {
  const range = resolveDateRange(query.preset, query.from, query.to);
  return computeProfitStats(locationId, range.start, range.end);
}

/**
 * Full per-product profitability breakdown for the period, sortable by quantity/revenue/cost/
 * profit/margin. Profit and margin are derived (not DB columns), so they can't be pushed into
 * a SQL ORDER BY — this groupBy has no `take`, sorts in JS, and paginates in JS afterward.
 * That's fine: like `computeProfitStats`, the result is bounded by the number of DISTINCT
 * variants sold in the window (the product catalog size — a few dozen items here), never by
 * transaction volume.
 */
export async function getProductProfitability(locationId: string, query: ProductProfitabilityQuery) {
  const range = resolveDateRange(query.preset, query.from, query.to);

  const grouped = await prisma.saleItem.groupBy({
    by: ["variantId"],
    where: { sale: { locationId, createdAt: { gte: range.start, lte: range.end } } },
    _sum: { quantity: true, subtotal: true },
  });

  if (grouped.length === 0) {
    return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
  }

  const [variants, costMap] = await Promise.all([
    prisma.productVariant.findMany({
      where: { id: { in: grouped.map((g) => g.variantId) } },
      include: { product: true },
    }),
    getVariantCostMap(grouped.map((g) => g.variantId)),
  ]);
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const rows = grouped.map((g) => {
    const variant = variantMap.get(g.variantId);
    const quantitySold = g._sum.quantity ?? ZERO;
    const revenue = g._sum.subtotal ?? ZERO;
    const cost = unitCostOf(costMap, g.variantId).mul(quantitySold);
    const profit = revenue.sub(cost);
    return {
      variantId: g.variantId,
      productName: variant?.product.name ?? "—",
      variantLabel: variant?.label ?? "—",
      quantitySold,
      revenue,
      cost,
      profit,
      marginValue: revenue.lessThanOrEqualTo(0) ? ZERO : profit.div(revenue).mul(100),
      hasCostData: costMap.has(g.variantId),
    };
  });

  const sortKey = { quantity: "quantitySold", revenue: "revenue", cost: "cost", profit: "profit", margin: "marginValue" } as const;
  const key = sortKey[query.sortBy];
  // A variant with no recipe prices at cost=0, which computes as a literal 100% margin — real
  // for the arithmetic, meaningless for ranking (the UI shows "—" for it, per `hasCostData`
  // above). Sorting by a cost-derived metric would otherwise float these to the very top,
  // ahead of genuinely profitable costed products. Push them to the end regardless of
  // direction instead — same treatment as the null `forecastDays` case in ingredient analytics.
  const isCostDerived = query.sortBy === "cost" || query.sortBy === "profit" || query.sortBy === "margin";
  rows.sort((a, b) => {
    if (isCostDerived) {
      if (!a.hasCostData && !b.hasCostData) return 0;
      if (!a.hasCostData) return 1;
      if (!b.hasCostData) return -1;
    }
    const cmp = a[key].comparedTo(b[key]);
    return query.sortDir === "asc" ? cmp : -cmp;
  });

  const total = rows.length;
  const start = (query.page - 1) * query.pageSize;
  const pageRows = rows.slice(start, start + query.pageSize);

  return {
    items: pageRows.map((r) => ({
      variantId: r.variantId,
      productName: r.productName,
      variantLabel: r.variantLabel,
      quantitySold: r.quantitySold.toString(),
      revenue: r.revenue.toString(),
      cost: r.cost.toString(),
      profit: r.profit.toString(),
      margin: r.marginValue.toDecimalPlaces(1).toString(),
      hasCostData: r.hasCostData,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Per-ingredient consumption analytics: how much of each active ingredient was consumed by
 * sales (the same `StockReason.SALE` movements `deductRecipeIngredients` logs) in the period,
 * its cost, current stock, and a simple shortage forecast — days remaining at the period's
 * average daily consumption rate. One `groupBy` over StockMovement (bounded by the ingredient
 * catalog size), not one row per movement — same reasoning as `getProductProfitability`.
 */
export async function getIngredientAnalytics(locationId: string, query: IngredientAnalyticsQuery) {
  const range = resolveDateRange(query.preset, query.from, query.to);
  const days = Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000)));

  const [ingredients, consumed] = await Promise.all([
    prisma.ingredient.findMany({
      where: { isActive: true },
      include: { stock: { where: { locationId } } },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.groupBy({
      by: ["ingredientId"],
      where: { locationId, reason: "SALE", createdAt: { gte: range.start, lte: range.end } },
      _sum: { change: true },
    }),
  ]);

  const consumedMap = new Map(consumed.map((c) => [c.ingredientId, (c._sum.change ?? ZERO).abs()]));

  const rows = ingredients.map((ingredient) => {
    const quantity = ingredient.stock[0]?.quantity ?? ZERO;
    const consumedQty = consumedMap.get(ingredient.id) ?? ZERO;
    const cost = consumedQty.mul(ingredient.avgUnitCost);
    const dailyRate = consumedQty.div(days);
    // null = "no recent consumption, can't project a run-out date" — not the same as "0 days
    // left," which would (wrongly) read as an urgent shortage.
    const forecastDays = dailyRate.greaterThan(0) ? quantity.div(dailyRate) : null;

    return { id: ingredient.id, name: ingredient.name, unit: ingredient.unit, quantity, consumedQty, cost, forecastDays };
  });

  const sortKey = { consumption: "consumedQty", cost: "cost", quantity: "quantity", forecastDays: "forecastDays" } as const;
  const key = sortKey[query.sortBy];
  rows.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    // Nulls (no forecast) always sort last regardless of direction — "can't predict" isn't
    // meaningfully "highest" or "lowest," so it shouldn't get pinned to whichever end the
    // current sort direction happens to favor.
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    const cmp = av.comparedTo(bv);
    return query.sortDir === "asc" ? cmp : -cmp;
  });

  const total = rows.length;
  const start = (query.page - 1) * query.pageSize;
  const pageRows = rows.slice(start, start + query.pageSize);

  return {
    items: pageRows.map((r) => ({
      id: r.id,
      name: r.name,
      unit: r.unit,
      quantity: r.quantity.toString(),
      consumed: r.consumedQty.toString(),
      cost: r.cost.toString(),
      forecastDays: r.forecastDays ? r.forecastDays.toDecimalPlaces(1).toString() : null,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}
