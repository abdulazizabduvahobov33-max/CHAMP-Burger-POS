/**
 * READ-ONLY production reconciliation. No writes anywhere in this file — every query is a
 * SELECT/aggregate. Points a separate PrismaClient at PRODUCTION_DATABASE_URL (never printed)
 * only to compare numbers; never touches the local TEST DB client.
 *
 * Run from server/:  npx tsx prisma/reportsProdReadOnlyCheck.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const productionDatabaseUrl = process.env.PRODUCTION_DATABASE_URL;
if (!productionDatabaseUrl) {
  console.error("PRODUCTION_DATABASE_URL not set — aborting (this script must never fall back to the default DATABASE_URL).");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: productionDatabaseUrl } } });

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function checkTotalAmountConsistency() {
  console.log("=== Section 3: Sale.totalAmount == SUM(active SaleItem.subtotal) for ACCEPTED sales (read-only) ===");
  const sales = await prisma.sale.findMany({
    where: { status: "ACCEPTED" },
    select: { id: true, totalAmount: true, createdAt: true, items: { where: { removedAt: null }, select: { subtotal: true } } },
  });
  console.log(`Checked ${sales.length} ACCEPTED sales in production.`);
  const mismatches: { id: string; createdAt: Date; stored: string; computed: string; diff: string }[] = [];
  for (const sale of sales) {
    const computed = sale.items.reduce((sum, i) => sum.add(i.subtotal), new Prisma.Decimal(0));
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
    console.log("RESULT: 0 mismatches found. Every ACCEPTED sale's stored totalAmount matches the real sum of its active items.");
  } else {
    console.log(`RESULT: ${mismatches.length} MISMATCHES FOUND — USER DECISION REQUIRED before touching any of these rows.`);
    for (const m of mismatches) {
      console.log(`  sale ${m.id} | createdAt=${m.createdAt.toISOString()} | stored=${m.stored} | computed=${m.computed} | diff=${m.diff}`);
    }
  }
  return mismatches;
}

async function reconcileTodayAndYesterday() {
  console.log("\n=== Section 9: independent reconciliation of Сегодня/Вчера against the API's own logic (read-only) ===");
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStart = startOfDay(yesterday);
  const yEnd = endOfDay(yesterday);

  for (const [label, start, end] of [
    ["today (server-local)", todayStart, todayEnd],
    ["yesterday (server-local)", yStart, yEnd],
  ] as const) {
    const sales = await prisma.sale.findMany({
      where: { status: "ACCEPTED", createdAt: { gte: start, lte: end } },
      select: { totalAmount: true, items: { where: { removedAt: null }, select: { subtotal: true } } },
    });
    const orderCount = sales.length;
    const revenueFromStoredTotal = sales.reduce((s, sale) => s.add(sale.totalAmount), new Prisma.Decimal(0));
    const revenueFromItemSum = sales.reduce(
      (s, sale) => s.add(sale.items.reduce((si, i) => si.add(i.subtotal), new Prisma.Decimal(0))),
      new Prisma.Decimal(0),
    );
    console.log(
      `${label}: window ${start.toISOString()}..${end.toISOString()} | orders=${orderCount} | revenue(stored totalAmount)=${revenueFromStoredTotal} | revenue(independent item-sum)=${revenueFromItemSum} | ${revenueFromStoredTotal.equals(revenueFromItemSum) ? "MATCH" : "MISMATCH"}`,
    );
  }
}

async function main() {
  await checkTotalAmountConsistency();
  await reconcileTodayAndYesterday();
}

main()
  .catch((err) => {
    console.error("Production read-only check failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
