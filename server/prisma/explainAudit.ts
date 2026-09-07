/**
 * EXPLAIN (ANALYZE, BUFFERS) against the key read-query patterns actually used by
 * report.service.ts / owner.service.ts / sale.service.ts, run against TEST DB after
 * growthSimulation.ts has populated realistic row volume (10k sales / ~35k items / ~31k
 * movements). SQL below mirrors the exact WHERE/ORDER BY/GROUP BY shape Prisma generates for
 * each real call site (traced from the query-event log in config/db.ts) — this is read-only,
 * never modifies data.
 *
 * Run from server/ AFTER growthSimulation.ts:  npx tsx prisma/explainAudit.ts
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const SIM_LOCATION_ID = "growth-sim-location";

async function explain(label: string, sql: string) {
  console.log(`\n=== ${label} ===`);
  const rows = (await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`)) as { "QUERY PLAN": string }[];
  for (const r of rows) console.log(r["QUERY PLAN"]);
}

async function main() {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // report.service.ts's listSales — locationId + status + createdAt range, ordered, paginated.
  await explain(
    "listSales (locationId + status=ACCEPTED + createdAt range, ORDER BY createdAt DESC LIMIT 20)",
    `SELECT id, "createdAt", "totalAmount", "sellerId", "tableId" FROM sales
     WHERE "locationId" = '${SIM_LOCATION_ID}' AND status = 'ACCEPTED'
       AND "createdAt" >= '${monthAgo.toISOString()}' AND "createdAt" <= '${now.toISOString()}'
     ORDER BY "createdAt" DESC LIMIT 20 OFFSET 0`,
  );

  // report.costing.ts's computeProfitStats — revenue aggregate over the same window.
  await explain(
    "computeProfitStats revenue aggregate (Sale SUM/COUNT over locationId+status+date range)",
    `SELECT SUM("totalAmount"), COUNT(*) FROM sales
     WHERE "locationId" = '${SIM_LOCATION_ID}' AND status = 'ACCEPTED'
       AND "createdAt" >= '${monthAgo.toISOString()}' AND "createdAt" <= '${now.toISOString()}'`,
  );

  // computeProfitStats's snapshot-cost aggregate — SaleItem joined to Sale, filtered both sides.
  await explain(
    "computeProfitStats snapshot-cost aggregate (SaleItem JOIN Sale, removedAt+hasCostSnapshot+date range)",
    `SELECT SUM(si."costSnapshot") FROM sale_items si
     JOIN sales s ON s.id = si."saleId"
     WHERE si."removedAt" IS NULL AND si."hasCostSnapshot" = true
       AND s."locationId" = '${SIM_LOCATION_ID}' AND s.status = 'ACCEPTED'
       AND s."createdAt" >= '${monthAgo.toISOString()}' AND s."createdAt" <= '${now.toISOString()}'`,
  );

  // getTopProducts / getProductProfitability — groupBy variantId over a date-ranged, joined set.
  await explain(
    "getTopProducts (SaleItem GROUP BY variantId, JOIN Sale, date range, ORDER BY SUM(quantity) DESC)",
    `SELECT si."variantId", SUM(si.quantity) AS qty, SUM(si.subtotal) AS revenue FROM sale_items si
     JOIN sales s ON s.id = si."saleId"
     WHERE si."removedAt" IS NULL AND s."locationId" = '${SIM_LOCATION_ID}' AND s.status = 'ACCEPTED'
       AND s."createdAt" >= '${weekAgo.toISOString()}' AND s."createdAt" <= '${now.toISOString()}'
     GROUP BY si."variantId" ORDER BY qty DESC LIMIT 10`,
  );

  // sale.service.ts's listPendingSales — the admin's live pending-orders queue.
  await explain(
    "listPendingSales (locationId + status=PENDING, ORDER BY createdAt ASC)",
    `SELECT id, "createdAt", "totalAmount" FROM sales
     WHERE "locationId" = '${SIM_LOCATION_ID}' AND status = 'PENDING'
     ORDER BY "createdAt" ASC`,
  );

  // sale.service.ts's listMySales — a single seller's own history, paginated.
  const someSeller = await prisma.user.findFirst({ where: { locationId: SIM_LOCATION_ID }, select: { id: true } });
  await explain(
    "listMySales (sellerId, ORDER BY createdAt DESC LIMIT 20)",
    `SELECT id, "createdAt", "totalAmount", status FROM sales
     WHERE "sellerId" = '${someSeller!.id}'
     ORDER BY "createdAt" DESC LIMIT 20 OFFSET 0`,
  );

  // getIngredientAnalytics — StockMovement GROUP BY ingredientId, date range + reason.
  await explain(
    "getIngredientAnalytics (StockMovement GROUP BY ingredientId, locationId+reason+date range)",
    `SELECT "ingredientId", SUM(change) FROM stock_movements
     WHERE "locationId" = '${SIM_LOCATION_ID}' AND reason = 'SALE'
       AND "createdAt" >= '${monthAgo.toISOString()}' AND "createdAt" <= '${now.toISOString()}'
     GROUP BY "ingredientId"`,
  );

  // getSaleDetail / owner sale detail — single sale + its items (point lookup + FK scan).
  const someSale = await prisma.sale.findFirst({ where: { locationId: SIM_LOCATION_ID }, select: { id: true } });
  await explain(
    "getSaleDetail items lookup (SaleItem WHERE saleId, removedAt IS NULL)",
    `SELECT * FROM sale_items WHERE "saleId" = '${someSale!.id}' AND "removedAt" IS NULL`,
  );

  // createSale's clientRequestId idempotency pre-check.
  await explain(
    "createSale idempotency pre-check (Sale WHERE clientRequestId, unique index point lookup)",
    `SELECT id FROM sales WHERE "clientRequestId" = '${randomUUIDLike()}'`,
  );
}

function randomUUIDLike() {
  return "00000000-0000-0000-0000-000000000000";
}

main()
  .catch((err) => {
    console.error("Explain audit failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
