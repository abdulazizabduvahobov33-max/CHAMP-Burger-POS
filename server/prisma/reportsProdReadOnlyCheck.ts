/**
 * READ-ONLY production reconciliation for Reports/financial consistency.
 *
 * Safety, all enforced in code (not just by convention):
 *  - Every query in this file is a SELECT/aggregate/groupBy. There is no `create`/`update`/
 *    `delete`/`upsert`/`executeRaw` write call anywhere below — grep this file for those
 *    method names as your own check before running it.
 *  - Everything runs inside ONE Prisma interactive transaction whose very first statement sets
 *    the real Postgres session to `SET TRANSACTION READ ONLY` — so even a bug in this script
 *    that tried to write would be rejected by Postgres itself, not just "we didn't call the
 *    method." This is a stronger guarantee than "the code doesn't happen to write."
 *  - Never runs `prisma migrate`/`db seed` or anything schema-changing.
 *  - Never prints PRODUCTION_DATABASE_URL, any connection string, or any credential — not even
 *    masked. The only output is aggregate business numbers (counts, sums, ids of any mismatch
 *    found) and computed date-range boundaries.
 *  - If PRODUCTION_DATABASE_URL is unset, this exits immediately — it never silently falls back
 *    to the local DATABASE_URL and pretends that's production.
 *
 * To use: set PRODUCTION_DATABASE_URL in server/.env (already gitignored — see .gitignore) to
 * the current Neon connection string yourself, locally. This script never asks for it and never
 * prints it back.
 *
 * Run from server/:  npx tsx prisma/reportsProdReadOnlyCheck.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import dotenv from "dotenv";

import { resolveDateRange } from "../src/shared/utils/dateRange.js";

dotenv.config();

const productionDatabaseUrl = process.env.PRODUCTION_DATABASE_URL;
if (!productionDatabaseUrl) {
  console.error("PRODUCTION_DATABASE_URL is not set — aborting. This script never falls back to DATABASE_URL.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: productionDatabaseUrl } } });

type Tx = Prisma.TransactionClient;
const ZERO = new Prisma.Decimal(0);

async function checkTotalAmountConsistency(tx: Tx) {
  console.log("=== Sale.totalAmount == SUM(active SaleItem.subtotal) for every ACCEPTED sale ===");
  const sales = await tx.sale.findMany({
    where: { status: "ACCEPTED" },
    select: { id: true, totalAmount: true, createdAt: true, items: { where: { removedAt: null }, select: { subtotal: true } } },
  });
  console.log(`Checked ${sales.length} ACCEPTED sales.`);
  const mismatches: { id: string; createdAt: Date; stored: string; computed: string; diff: string }[] = [];
  for (const sale of sales) {
    const computed = sale.items.reduce((sum, i) => sum.add(i.subtotal), ZERO);
    if (!computed.equals(sale.totalAmount)) {
      mismatches.push({
        id: sale.id,
        createdAt: sale.createdAt,
        stored: sale.totalAmount.toString(),
        computed: computed.toString(),
        diff: sale.totalAmount.sub(computed).toString(),
      });
    }
  }
  if (mismatches.length === 0) {
    console.log("RESULT: 0 mismatches. Every ACCEPTED sale's stored totalAmount matches the real sum of its active items.\n");
  } else {
    console.log(`RESULT: ${mismatches.length} MISMATCHES FOUND — USER DECISION REQUIRED. Nothing was changed.`);
    for (const m of mismatches) {
      console.log(`  sale ${m.id} | createdAt=${m.createdAt.toISOString()} | stored=${m.stored} | computed=${m.computed} | diff=${m.diff}`);
    }
    console.log("");
  }
  return mismatches;
}

/** Independent recomputation for one period: uses the REAL resolveDateRange (now Asia/Tashkent-
 * correct) for the window boundaries — same as the API — but computes revenue/count via its own
 * separately-written query, not by calling report.service.ts's functions, so this is a genuine
 * cross-check rather than the app comparing its own answer to itself. */
async function reconcilePeriod(tx: Tx, label: string, preset: "today" | "yesterday", from?: string, to?: string) {
  const range = from && to ? resolveDateRange("custom", from, to) : resolveDateRange(preset);
  const sales = await tx.sale.findMany({
    where: { status: "ACCEPTED", createdAt: { gte: range.start, lte: range.end } },
    select: { totalAmount: true, items: { where: { removedAt: null }, select: { subtotal: true } } },
  });
  const orderCount = sales.length;
  const revenueFromStoredTotal = sales.reduce((s, sale) => s.add(sale.totalAmount), ZERO);
  const revenueFromItemSum = sales.reduce(
    (s, sale) => s.add(sale.items.reduce((si, i) => si.add(i.subtotal), ZERO)),
    ZERO,
  );
  const match = revenueFromStoredTotal.equals(revenueFromItemSum);
  console.log(
    `${label}: window ${range.start.toISOString()}..${range.end.toISOString()} | orders=${orderCount} | revenue(stored)=${revenueFromStoredTotal} | revenue(independent item-sum)=${revenueFromItemSum} | ${match ? "MATCH" : "MISMATCH"}`,
  );
  return { orderCount, match };
}

async function checkCancelledAndRemovedExcluded(tx: Tx) {
  console.log("\n=== Cancelled sales / removed items correctly excluded from revenue ===");
  const [cancelledCount, cancelledWithNonzeroTotal, removedItemCount, removedItemsStillCountedAnywhere] = await Promise.all([
    tx.sale.count({ where: { status: "CANCELLED" } }),
    // A cancelled sale's totalAmount is never reset to 0 (cancelSale doesn't touch it — see
    // owner.service.ts) — that's fine BY DESIGN as long as reports filter status:"ACCEPTED"
    // everywhere, which is what this whole check is verifying, not a bug in itself.
    tx.sale.count({ where: { status: "CANCELLED", totalAmount: { gt: 0 } } }),
    tx.saleItem.count({ where: { removedAt: { not: null } } }),
    // If any removed item's subtotal is still reachable through an ACCEPTED sale's active-item
    // sum, that would mean removedAt filtering is broken somewhere — this re-derives totals for
    // every ACCEPTED sale INCLUDING removed items and compares against the real (removedAt:null)
    // stored total; a match here would be the actual bug (removed item's value leaking in).
    tx.sale.findMany({
      where: { status: "ACCEPTED", items: { some: { removedAt: { not: null } } } },
      select: { id: true, totalAmount: true, items: { select: { subtotal: true, removedAt: true } } },
    }),
  ]);

  console.log(`CANCELLED sales in DB: ${cancelledCount} (${cancelledWithNonzeroTotal} carry a nonzero totalAmount — expected, they're just excluded by status everywhere, not zeroed out)`);
  console.log(`Removed (soft-deleted) SaleItem rows in DB: ${removedItemCount}`);

  let leakFound = 0;
  for (const sale of removedItemsStillCountedAnywhere) {
    const activeSum = sale.items.filter((i) => i.removedAt === null).reduce((s, i) => s.add(i.subtotal), ZERO);
    const allSum = sale.items.reduce((s, i) => s.add(i.subtotal), ZERO);
    if (sale.totalAmount.equals(allSum) && !allSum.equals(activeSum)) {
      leakFound++;
      console.log(`  POSSIBLE LEAK: sale ${sale.id} totalAmount=${sale.totalAmount} equals the sum INCLUDING removed items (${allSum}), not the active-only sum (${activeSum})`);
    }
  }
  console.log(leakFound === 0 ? "RESULT: 0 sales found where a removed item's value leaked into totalAmount.\n" : `RESULT: ${leakFound} POSSIBLE LEAKS — USER DECISION REQUIRED.\n`);
  return leakFound;
}

async function main() {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");

      const totalAmountMismatches = await checkTotalAmountConsistency(tx);
      await reconcilePeriod(tx, "today", "today");
      await reconcilePeriod(tx, "yesterday", "yesterday");
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      const toISO = (d: Date) => d.toISOString().slice(0, 10);
      await reconcilePeriod(tx, "last 7 days (custom range, same as UI 'Неделя' preset would use)", "today", toISO(weekAgo), toISO(new Date()));
      const leaks = await checkCancelledAndRemovedExcluded(tx);

      console.log("=== SUMMARY ===");
      console.log(`totalAmount mismatches: ${totalAmountMismatches.length}`);
      console.log(`removed-item leaks: ${leaks}`);
      console.log(totalAmountMismatches.length === 0 && leaks === 0 ? "No discrepancies found in any check above." : "Discrepancies found — see USER DECISION REQUIRED notes above. Nothing was modified.");
    },
    { timeout: 60_000 },
  );
}

main()
  .catch((err) => {
    console.error("Production read-only check failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
