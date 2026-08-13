import { Prisma } from "@prisma/client";

import { prisma } from "../../config/db.js";

export const ZERO = new Prisma.Decimal(0);

export type VariantCostMap = Map<string, Prisma.Decimal>;

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
export async function getVariantCostMap(variantIds: string[]): Promise<VariantCostMap> {
  const map: VariantCostMap = new Map();
  if (variantIds.length === 0) return map;

  const lines = await prisma.recipe.findMany({
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
};

/**
 * Central profit primitive: revenue/cost/profit/margin across ALL sales in `[start, end]`
 * (or all-time when both are omitted) at `locationId`. This is the one place the module's
 * revenue−cost=profit math is implemented — the dashboard's today/week/month/all-time cards
 * and the arbitrary-period profit-summary endpoint both call this instead of each
 * re-implementing the calculation.
 *
 * Cost comes from a single `groupBy` over SaleItem (same query shape `getTopProducts` already
 * uses), never by loading individual SaleItem rows — so this stays bounded by the number of
 * DISTINCT variants sold in the window (at most the size of the product catalog, typically a
 * few dozen for this business), not by how many sales/receipts exist in that window.
 */
export async function computeProfitStats(locationId: string, start?: Date, end?: Date): Promise<ProfitStats> {
  const dateWhere = start && end ? { createdAt: { gte: start, lte: end } } : {};
  // PENDING sales haven't deducted stock or captured payment yet (see sale.service.ts) — they
  // must not count as revenue/cost until an admin actually accepts them, or "today's revenue"
  // would include orders that might still be rejected or never paid.
  const acceptedOnly = { status: "ACCEPTED" as const };

  const [revenueAgg, grouped] = await Promise.all([
    prisma.sale.aggregate({
      where: { locationId, ...acceptedOnly, ...dateWhere },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.saleItem.groupBy({
      by: ["variantId"],
      // removedAt: null — matches revenueAgg above: Sale.totalAmount is already recomputed to
      // exclude owner-removed items (see owner.service.ts), so cost must exclude them too or
      // profit would be understated for a sale with a correction on it.
      where: { removedAt: null, sale: { locationId, ...acceptedOnly, ...dateWhere } },
      _sum: { quantity: true },
    }),
  ]);

  const revenue = revenueAgg._sum.totalAmount ?? ZERO;
  const receiptCount = revenueAgg._count._all;

  const costMap = await getVariantCostMap(grouped.map((g) => g.variantId));
  const cost = grouped.reduce((sum, g) => sum.add(unitCostOf(costMap, g.variantId).mul(g._sum.quantity ?? ZERO)), ZERO);

  const profit = revenue.sub(cost);

  return {
    revenue: revenue.toString(),
    cost: cost.toString(),
    profit: profit.toString(),
    margin: marginOf(revenue, profit),
    receiptCount,
    averageProfit: receiptCount > 0 ? profit.div(receiptCount).toString() : "0",
  };
}
