/**
 * Reports / financial consistency audit — runs ONLY against whatever DATABASE_URL is configured
 * (local dev DB when run normally; never point this at production). Creates its own isolated
 * fixtures (marked REPORTS_AUDIT_*), runs each scenario, prints actual DB state, and cleans up
 * after itself. Read-only for everything except its own fixtures.
 *
 * Run from server/:  npx tsx prisma/reportsAudit.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import dotenv from "dotenv";

import { createSale } from "../src/modules/sales/sale.service.js";
import { addSaleItem, updateSaleItem, removeSaleItem } from "../src/modules/owner/owner.service.js";
import { computeProfitStats, getVariantCostMap, unitCostOf } from "../src/modules/reports/report.costing.js";
import { resolveDateRange } from "../src/shared/utils/dateRange.js";
import { DEFAULT_LOCATION_ID } from "../src/bootstrap/menu.js";

dotenv.config();

const prisma = new PrismaClient();

const MARK = "REPORTS_AUDIT";
let categoryId!: string;
let productId!: string;
let variantAId!: string;
let variantBId!: string;
let ingredientId!: string;
let adminId!: string;
let ownerId!: string;

async function setup() {
  const admin = await prisma.user.findUnique({ where: { login: process.env.SEED_ADMIN_LOGIN || "admin" } });
  if (!admin) throw new Error("Expected local dev admin user to exist.");
  adminId = admin.id;

  const existingOwner = await prisma.user.findFirst({ where: { role: "OWNER" } });
  if (existingOwner) {
    ownerId = existingOwner.id;
  } else {
    const location = await prisma.location.findUniqueOrThrow({ where: { id: DEFAULT_LOCATION_ID } });
    const created = await prisma.user.create({
      data: {
        name: `${MARK}_OWNER`,
        login: `${MARK.toLowerCase()}_owner_${Date.now()}`,
        passwordHash: "not-a-real-hash-audit-only",
        role: "OWNER",
        isActive: true,
        locationId: location.id,
      },
    });
    ownerId = created.id;
  }

  const category = await prisma.category.create({ data: { name: `${MARK}_CATEGORY` } });
  categoryId = category.id;

  const product = await prisma.product.create({ data: { name: `${MARK}_PRODUCT`, categoryId, saleType: "UNIT", isActive: true } });
  productId = product.id;

  const variantA = await prisma.productVariant.create({ data: { productId, label: "A", price: new Prisma.Decimal(1000), isActive: true } });
  const variantB = await prisma.productVariant.create({ data: { productId, label: "B", price: new Prisma.Decimal(2000), isActive: true } });
  variantAId = variantA.id;
  variantBId = variantB.id;

  const ingredient = await prisma.ingredient.create({ data: { name: `${MARK}_INGREDIENT`, unit: "PIECE", minQuantity: 0 } });
  ingredientId = ingredient.id;
  await prisma.recipe.create({ data: { variantId: variantAId, ingredientId, quantity: new Prisma.Decimal(1) } });
  await prisma.recipe.create({ data: { variantId: variantBId, ingredientId, quantity: new Prisma.Decimal(1) } });
  await prisma.stock.create({ data: { ingredientId, locationId: DEFAULT_LOCATION_ID, quantity: new Prisma.Decimal(1000) } });
}

async function actualTotal(saleId: string): Promise<Prisma.Decimal> {
  const items = await prisma.saleItem.findMany({ where: { saleId, removedAt: null } });
  return items.reduce((sum, i) => sum.add(i.subtotal), new Prisma.Decimal(0));
}

async function dbTotal(saleId: string): Promise<Prisma.Decimal> {
  const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
  return sale.totalAmount;
}

async function freshSale(): Promise<string> {
  const sale = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId: variantAId, quantity: 1 }], 1000, true);
  return sale.id;
}

async function checkInvariant(saleId: string, label: string) {
  const [stored, computed] = await Promise.all([dbTotal(saleId), actualTotal(saleId)]);
  const ok = stored.equals(computed);
  console.log(`${label}: Sale.totalAmount=${stored} | SUM(active items)=${computed} | ${ok ? "PASS" : "FAIL — MISMATCH"}`);
  return ok;
}

async function scenarioA_concurrentAdd() {
  console.log("\n=== A. Two concurrent addSaleItem() on the same sale ===");
  const saleId = await freshSale();
  await Promise.all([
    addSaleItem(DEFAULT_LOCATION_ID, saleId, ownerId, { variantId: variantAId, quantity: 1 }),
    addSaleItem(DEFAULT_LOCATION_ID, saleId, ownerId, { variantId: variantBId, quantity: 1 }),
  ]);
  const itemCount = await prisma.saleItem.count({ where: { saleId, removedAt: null } });
  console.log(`Items on sale: ${itemCount} (expect 3: original A@1000 + added A@1000 + added B@2000 = 4000)`);
  await checkInvariant(saleId, "After 2 concurrent adds");
}

async function scenarioB_concurrentUpdate() {
  console.log("\n=== B. Two concurrent updateSaleItem() on the SAME item (both change quantity) ===");
  const saleId = await freshSale();
  const item = await prisma.saleItem.findFirstOrThrow({ where: { saleId } });
  const [r1, r2] = await Promise.allSettled([
    updateSaleItem(DEFAULT_LOCATION_ID, saleId, item.id, ownerId, { quantity: 3 }),
    updateSaleItem(DEFAULT_LOCATION_ID, saleId, item.id, ownerId, { quantity: 5 }),
  ]);
  console.log("Update 1:", r1.status, r1.status === "rejected" ? (r1 as PromiseRejectedResult).reason.message : "ok");
  console.log("Update 2:", r2.status, r2.status === "rejected" ? (r2 as PromiseRejectedResult).reason.message : "ok");
  const finalItem = await prisma.saleItem.findUniqueOrThrow({ where: { id: item.id } });
  console.log(`Final item quantity: ${finalItem.quantity} | subtotal: ${finalItem.subtotal}`);
  await checkInvariant(saleId, "After 2 concurrent quantity updates on the same item");
}

async function scenarioC_addConcurrentWithUpdate() {
  console.log("\n=== C. addSaleItem concurrent with updateSaleItem (different items) ===");
  const saleId = await freshSale();
  const originalItem = await prisma.saleItem.findFirstOrThrow({ where: { saleId } });
  await Promise.all([
    addSaleItem(DEFAULT_LOCATION_ID, saleId, ownerId, { variantId: variantBId, quantity: 2 }),
    updateSaleItem(DEFAULT_LOCATION_ID, saleId, originalItem.id, ownerId, { quantity: 4 }),
  ]);
  await checkInvariant(saleId, "After concurrent add + update on different items");
}

function gate(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

/**
 * The 4 black-box Promise.all scenarios above all PASSED — but on localhost, a whole
 * $transaction (several sequential round trips) typically completes in well under a
 * millisecond, so two "concurrent" calls rarely actually straddle recomputeTotal's
 * unguarded SELECT-then-UPDATE window. A pass there does NOT prove the window is safe,
 * only that it wasn't hit this time. This scenario removes luck from the equation: it
 * drives two real, separate $transaction calls against the SAME sale, with explicit gates
 * forcing the exact interleaving that causes a lost update — T2's read must happen while
 * T1's insert is still uncommitted, matching recomputeTotal's real (unguarded) read shape
 * line for line, then both write to Sale.totalAmount for real.
 */
async function scenarioE_forcedInterleave() {
  console.log("\n=== E. FORCED interleaving — proves the recomputeTotal race mechanism itself, independent of scheduler luck ===");
  const saleId = await freshSale(); // starts at 1x variantA@1000 = 1000
  const t1ReadDone = gate();
  const t2ReadDone = gate();

  const runT1 = prisma.$transaction(async (tx) => {
    await tx.saleItem.create({ data: { saleId, variantId: variantBId, quantity: 1, unitPrice: new Prisma.Decimal(2000), subtotal: new Prisma.Decimal(2000) } });
    const items = await tx.saleItem.findMany({ where: { saleId, removedAt: null }, select: { subtotal: true } });
    const total = items.reduce((sum, i) => sum.add(i.subtotal), new Prisma.Decimal(0));
    console.log(`  T1 read total=${total} (should be missing T2's item — T2 hasn't committed yet)`);
    t1ReadDone.resolve();
    await t2ReadDone.promise; // hold the transaction open until T2 has also read
    await tx.sale.update({ where: { id: saleId }, data: { totalAmount: total } });
  });

  const runT2 = prisma.$transaction(async (tx) => {
    await t1ReadDone.promise; // wait for T1 to have inserted (but NOT committed) its item
    await tx.saleItem.updateMany({ where: { saleId, variantId: variantAId }, data: { quantity: 3, subtotal: new Prisma.Decimal(3000) } });
    const items = await tx.saleItem.findMany({ where: { saleId, removedAt: null }, select: { subtotal: true } });
    const total = items.reduce((sum, i) => sum.add(i.subtotal), new Prisma.Decimal(0));
    console.log(`  T2 read total=${total} (should be missing T1's still-uncommitted item)`);
    t2ReadDone.resolve();
    await tx.sale.update({ where: { id: saleId }, data: { totalAmount: total } });
  });

  await Promise.all([runT1, runT2]);

  const [stored, computed] = await Promise.all([dbTotal(saleId), actualTotal(saleId)]);
  console.log(`Actual DB rows: variantA item subtotal should be 3000 (updated by T2), variantB item subtotal should be 2000 (inserted by T1) → real SUM=${computed}`);
  console.log(`Sale.totalAmount ended up = ${stored}`);
  if (stored.equals(computed)) {
    console.log("Did not reproduce a lost update THIS run (both writes happened to land consistently) — inconclusive, not a clean bill of health given the code has no guard.");
  } else {
    console.log(`CONFIRMED — LOST UPDATE: Sale.totalAmount (${stored}) != real SUM of active SaleItems (${computed}). One of the two concurrent corrections was silently dropped from the sale's total even though its SaleItem row is correctly persisted. This is a genuine data-integrity bug reachable any time two owner corrections (or an owner correction + an add) land on the same sale close together — more likely in production, where each DB round trip costs 5-50ms+ (Neon), widening this exact window far beyond what localhost shows.`);
  }
}

async function scenarioD_removeConcurrentWithUpdate() {
  console.log("\n=== D. removeSaleItem concurrent with updateSaleItem on the SAME item ===");
  const saleId = await freshSale();
  const item = await prisma.saleItem.findFirstOrThrow({ where: { saleId } });
  const [removeResult, updateResult] = await Promise.allSettled([
    removeSaleItem(DEFAULT_LOCATION_ID, saleId, item.id, ownerId, {}),
    updateSaleItem(DEFAULT_LOCATION_ID, saleId, item.id, ownerId, { quantity: 9 }),
  ]);
  console.log("Remove:", removeResult.status, removeResult.status === "rejected" ? (removeResult as PromiseRejectedResult).reason.message : "ok");
  console.log("Update:", updateResult.status, updateResult.status === "rejected" ? (updateResult as PromiseRejectedResult).reason.message : "ok");
  const finalItem = await prisma.saleItem.findUniqueOrThrow({ where: { id: item.id } });
  console.log(`Final item: removedAt=${finalItem.removedAt !== null} quantity=${finalItem.quantity}`);
  await checkInvariant(saleId, "After concurrent remove+update on the same item");
}

async function scenarioHistoricalCostDrift() {
  console.log("\n=== Historical correctness: does changing avgUnitCost retroactively change an OLD sale's reported profit? ===");
  const saleId = await freshSale(); // 1x variantA @ revenue 1000, recipe: 1x ingredient

  await prisma.ingredient.update({ where: { id: ingredientId }, data: { avgUnitCost: new Prisma.Decimal(100) } });
  const costMap1 = await getVariantCostMap([variantAId]);
  const profit1 = new Prisma.Decimal(1000).sub(unitCostOf(costMap1, variantAId));
  console.log(`With avgUnitCost=100: this sale's item cost=${unitCostOf(costMap1, variantAId)}, profit=${profit1}`);

  await prisma.ingredient.update({ where: { id: ingredientId }, data: { avgUnitCost: new Prisma.Decimal(400) } });
  const costMap2 = await getVariantCostMap([variantAId]);
  const profit2 = new Prisma.Decimal(1000).sub(unitCostOf(costMap2, variantAId));
  console.log(`With avgUnitCost=400 (changed AFTER the sale, nothing else touched): same sale's item cost=${unitCostOf(costMap2, variantAId)}, profit=${profit2}`);

  const changed = !profit1.equals(profit2);
  console.log(
    changed
      ? "CONFIRMED: reported cost/profit for this already-completed sale changed retroactively — cost is NOT a historical snapshot, it's computed live from current avgUnitCost. This matches the code's own documented design (report.costing.ts), not a bug introduced here — but it means historical profit reports are NOT stable over time. Revenue (Sale.totalAmount/SaleItem.subtotal) is unaffected — only cost/profit drifts."
      : "UNEXPECTED: cost did not change — investigate before trusting this finding.",
  );

  await prisma.saleChangeLog.deleteMany({ where: { saleId } });
  await prisma.saleItem.deleteMany({ where: { saleId } });
  await prisma.sale.deleteMany({ where: { id: saleId } });
}

async function scenarioTimezoneBoundary() {
  console.log("\n=== Timezone: does 'today' use the server process's local TZ (no per-business setting)? ===");
  // Not a DB test — resolveDateRange() is pure JS Date math over `new Date()` (the CURRENT
  // process's wall clock / TZ), so this demonstrates the mechanism directly: two processes with
  // different TZ settings compute a DIFFERENT "today" window for the exact same real instant.
  console.log(`This process's TZ env: ${process.env.TZ ?? "(unset — uses the OS/container default)"}`);
  console.log(`This process's resolved offset right now: UTC${new Date().getTimezoneOffset() <= 0 ? "+" : "-"}${Math.abs(new Date().getTimezoneOffset() / 60)}`);
  const range = resolveDateRange("today");
  console.log(`"today" resolves to: ${range.start.toISOString()} .. ${range.end.toISOString()} (in THIS process's local time)`);
  console.log(
    "If the deployed backend's container runs in UTC (Render's platform default, no TZ env var set) while Sharof KFS operates in Asia/Tashkent (UTC+5), " +
      "this exact window is shifted 5 hours from Tashkent's real midnight-to-midnight — an order placed between 00:00 and 05:00 Tashkent time " +
      "would be bucketed into the PREVIOUS UTC calendar day, i.e. counted as 'yesterday' in Сегодня/Вчера reports. " +
      "This is a real, pre-existing characteristic already documented in dateRange.ts's own comment — not something this audit changed.",
  );
}

/**
 * Scenario E deliberately bypasses owner.service.ts to prove the underlying mechanism was
 * dangerous — it will keep "failing" forever by design and is not evidence about the fix. This
 * scenario is the actual regression check: it hammers the REAL (now-fixed) addSaleItem +
 * updateSaleItem functions concurrently, many times, to build real confidence the new FOR UPDATE
 * lock holds under repeated real concurrency rather than trusting a single lucky pass.
 */
async function scenarioF_fixedFunctionsRepeatedConcurrency(iterations = 15) {
  console.log(`\n=== F. Real (fixed) addSaleItem + updateSaleItem raced ${iterations}x — regression check for the FOR UPDATE fix ===`);
  let failures = 0;
  for (let i = 0; i < iterations; i++) {
    const saleId = await freshSale();
    const original = await prisma.saleItem.findFirstOrThrow({ where: { saleId } });
    await Promise.all([
      addSaleItem(DEFAULT_LOCATION_ID, saleId, ownerId, { variantId: variantBId, quantity: 1 }),
      updateSaleItem(DEFAULT_LOCATION_ID, saleId, original.id, ownerId, { quantity: 3 }),
    ]);
    const [stored, computed] = await Promise.all([dbTotal(saleId), actualTotal(saleId)]);
    if (!stored.equals(computed)) {
      failures++;
      console.log(`  iteration ${i}: FAIL — totalAmount=${stored} vs real SUM=${computed}`);
    }
  }
  console.log(failures === 0 ? `All ${iterations} iterations PASS — totalAmount stayed consistent every time.` : `${failures}/${iterations} iterations FAILED — the lock does not fully close the race.`);
  return failures === 0;
}

async function cleanup() {
  const items = await prisma.saleItem.findMany({ where: { OR: [{ variantId: variantAId }, { variantId: variantBId }] }, select: { saleId: true } });
  const saleIds = [...new Set(items.map((i) => i.saleId))];
  await prisma.saleChangeLog.deleteMany({ where: { saleId: { in: saleIds } } });
  await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
  await prisma.stockMovement.deleteMany({ where: { ingredientId } });
  await prisma.stock.deleteMany({ where: { ingredientId } });
  await prisma.recipe.deleteMany({ where: { ingredientId } });
  await prisma.ingredient.deleteMany({ where: { id: ingredientId } });
  await prisma.productVariant.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.user.deleteMany({ where: { login: { startsWith: `${MARK.toLowerCase()}_owner_` } } });
}

async function main() {
  console.log(`Connected DB: ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ":***@")}`);
  await setup();
  try {
    await scenarioA_concurrentAdd();
    await scenarioB_concurrentUpdate();
    await scenarioC_addConcurrentWithUpdate();
    await scenarioD_removeConcurrentWithUpdate();
    await scenarioE_forcedInterleave();
    await scenarioF_fixedFunctionsRepeatedConcurrency();
    await scenarioHistoricalCostDrift();
    await scenarioTimezoneBoundary();
  } finally {
    await cleanup();
  }
}

main()
  .catch((err) => {
    console.error("Audit script failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
