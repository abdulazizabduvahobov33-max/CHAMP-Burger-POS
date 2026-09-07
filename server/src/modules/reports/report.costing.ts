import { Prisma } from "@prisma/client";

import { prisma } from "../../config/db.js";

export const ZERO = new Prisma.Decimal(0);

export type VariantCostMap = Map<string, Prisma.Decimal>;

/** Anything with the same shape as the top-level `prisma` client for the calls this module
 * makes — either the real client or a `$transaction` callback's `tx`. Letting callers pass
 * `tx` is what makes a cost snapshot computed INSIDE a sale/correction transaction actually
 * consistent with everything else that transaction reads/writes (see sale.service.ts's
 * createSale/acceptSale and owner.service.ts's addSaleItem/updateSaleItem). */
type QueryClient = Pick<typeof prisma, "recipe">;

/**
 * Cost per single unit of each variant = Σ(recipe.quantity × ingredient.avgUnitCost).
 *
 * Variants with no recipe lines (Kefsi has none — see recipe.service.ts) are simply absent
 * from the map; callers treat a missing entry as zero cost, the same "no recipe = nothing to
 * do" contract `deductRecipeIngredients` already established for this codebase. DIRECT-sale
 * products (Kofe, Limon choy) need no special case here — Module 6 already gives every DIRECT
 * variant a synthetic 1-line, qty-1 recipe pointing at its own stock ingredient, so the exact
 * same Recipe-lookup path prices them correctly without branching on `saleType`.
 *
 * Uses ingredients' CURRENT `avgUnitCost`, not a cost frozen at sale time — `SaleItem` has no
 * cost-snapshot column, and this is computed on demand from live data by design (per spec:
 * cost is derived via Recipe + "актуальный avgUnitCost"). This means a sale's reported cost/
 * profit can shift as later purchases change an ingredient's average cost — an accepted
 * characteristic of "current cost" reporting, not a bug (there is no per-sale cost history to
 * preserve; `PriceHistory` only ever tracked *selling* price and has never been written to).
 */
export async function getVariantCostMap(variantIds: string[], client: QueryClient = prisma): Promise<VariantCostMap> {
  const map: VariantCostMap = new Map();
  if (variantIds.length === 0) return map;

  const lines = await client.recipe.findMany({
    where: { variantId: { in: variantIds } },
    select: { variantId: true, quantity: true, ingredient: { select: { avgUnitCost: true } } },
  });

  for (const line of lines) {
    const lineCost = line.quantity.mul(line.ingredient.avgUnitCost);
    map.set(line.variantId, (map.get(line.variantId) ?? ZERO).add(lineCost));
  }
  return map;
}

export function unitCostOf(map: VariantCostMap, variantId: string): Prisma.Decimal {
  return map.get(variantId) ?? ZERO;
}

/** Profit margin as a percentage string, one decimal place. 0 revenue → "0" (not division by zero). */
export function marginOf(revenue: Prisma.Decimal, profit: Prisma.Decimal): string {
  if (revenue.lessThanOrEqualTo(0)) return "0";
  return profit.div(revenue).mul(100).toDecimalPlaces(1).toString();
}

export type ProfitStats = {
  revenue: string;
  cost: string;
  profit: string;
  margin: string;
  receiptCount: number;
  averageProfit: string;
  // True when at least one SaleItem in this period had no cost snapshot (a legacy sale from
  // before the snapshot column existed, or — for a currently-open period — a PENDING order not
  // yet accepted) and its cost had to fall back to today's live ingredient cost instead. When
  // true, `cost`/`profit`/`margin` are a mix of real historical figures and current-cost
  // estimates for the un-snapshotted portion — not a pure historical number. See getSaleDetail
  // for the same signal at individual-item granularity.
  costEstimated: boolean;
};

/**
 * Central profit primitive: revenue/cost/profit/margin across ALL sales in `[start, end]`
 * (or all-time when both are omitted) at `locationId`. This is the one place the module's
 * revenue−cost=profit math is implemented — the dashboard's today/week/month/all-time cards
 * and the arbitrary-period profit-summary endpoint both call this instead of each
 * re-implementing the calculation.
 *
 * Cost prefers each SaleItem's own frozen `costSnapshot` (captured at sale/accept time — see
 * sale.service.ts) — a single `aggregate` `_sum`, cheap regardless of row count. Only the
 * (ideally shrinking, post-migration) subset of items with NO snapshot falls back to a live
 * cost lookup, and that fallback is still bounded by DISTINCT variants among just those
 * un-snapshotted items, not by total row count — same complexity guarantee this function always
 * had, just split into "cheap sum" + "small live-cost fallback" instead of one groupBy.
 */
export async function computeProfitStats(locationId: string, start?: Date, end?: Date): Promise<ProfitStats> {
  const dateWhere = start && end ? { createdAt: { gte: start, lte: end } } : {};
  // PENDING sales haven't deducted stock or captured payment yet (see sale.service.ts) — they
  // must not count as revenue/cost until an admin actually accepts them, or "today's revenue"
  // would include orders that might still be rejected or never paid.
  const acceptedOnly = { status: "ACCEPTED" as const };
  // removedAt: null everywhere below — matches revenueAgg: Sale.totalAmount is already
  // recomputed to exclude owner-removed items (see owner.service.ts), so cost must exclude them
  // too or profit would be understated for a sale with a correction on it.
  const itemScope = { removedAt: null, sale: { locationId, ...acceptedOnly, ...dateWhere } };

  const [revenueAgg, snapshotCostAgg, liveNeeded] = await Promise.all([
    prisma.sale.aggregate({
      where: { locationId, ...acceptedOnly, ...dateWhere },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.saleItem.aggregate({
      where: { ...itemScope, hasCostSnapshot: true },
      _sum: { costSnapshot: true },
    }),
    prisma.saleItem.groupBy({
      by: ["variantId"],
      where: { ...itemScope, hasCostSnapshot: false },
      _sum: { quantity: true },
    }),
  ]);

  const revenue = revenueAgg._sum.totalAmount ?? ZERO;
  const receiptCount = revenueAgg._count._all;

  const liveCostMap = await getVariantCostMap(liveNeeded.map((g) => g.variantId));
  const liveCost = liveNeeded.reduce((sum, g) => sum.add(unitCostOf(liveCostMap, g.variantId).mul(g._sum.quantity ?? ZERO)), ZERO);
  const cost = (snapshotCostAgg._sum.costSnapshot ?? ZERO).add(liveCost);

  const profit = revenue.sub(cost);

  return {
    revenue: revenue.toString(),
    cost: cost.toString(),
    profit: profit.toString(),
    margin: marginOf(revenue, profit),
    receiptCount,
    averageProfit: receiptCount > 0 ? profit.div(receiptCount).toString() : "0",
    costEstimated: liveNeeded.length > 0,
  };
}
