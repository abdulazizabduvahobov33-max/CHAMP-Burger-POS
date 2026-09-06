/**
 * Order idempotency / concurrency audit — runs ONLY against whatever DATABASE_URL is configured
 * (local dev DB when run normally; never point this at production). Creates its own isolated
 * fixtures (marked CONCURRENCY_AUDIT_*), runs each scenario, prints actual DB state, and cleans
 * up after itself. Read-only for everything except its own fixtures.
 *
 * Run from server/:  npx tsx prisma/concurrencyAudit.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import dotenv from "dotenv";

import { createSale, acceptSale } from "../src/modules/sales/sale.service.js";
import { DEFAULT_LOCATION_ID } from "../src/bootstrap/menu.js";

dotenv.config();

const prisma = new PrismaClient();

const MARK = "CONCURRENCY_AUDIT";
let categoryId!: string;
let productId!: string;
let variantId!: string;
let ingredientId!: string;
let adminId!: string;
let sellerId!: string;

async function setup() {
  const admin = await prisma.user.findUnique({ where: { login: process.env.SEED_ADMIN_LOGIN || "admin" } });
  const seller = await prisma.user.findUnique({ where: { login: process.env.SEED_SELLER_LOGIN || "seller" } });
  if (!admin || !seller) throw new Error("Expected local dev admin+seller users to exist (bootstrap should have created them).");
  adminId = admin.id;
  sellerId = seller.id;

  const category = await prisma.category.create({ data: { name: `${MARK}_CATEGORY` } });
  categoryId = category.id;

  const product = await prisma.product.create({
    data: { name: `${MARK}_PRODUCT`, categoryId, saleType: "UNIT", isActive: true },
  });
  productId = product.id;

  const variant = await prisma.productVariant.create({
    data: { productId, label: "TEST", price: new Prisma.Decimal(1000), isActive: true },
  });
  variantId = variant.id;

  const ingredient = await prisma.ingredient.create({
    data: { name: `${MARK}_INGREDIENT`, unit: "PIECE", minQuantity: 0 },
  });
  ingredientId = ingredient.id;

  await prisma.recipe.create({ data: { variantId, ingredientId, quantity: new Prisma.Decimal(1) } });
}

async function setStock(quantity: number) {
  await prisma.stock.upsert({
    where: { ingredientId_locationId: { ingredientId, locationId: DEFAULT_LOCATION_ID } },
    update: { quantity: new Prisma.Decimal(quantity) },
    create: { ingredientId, locationId: DEFAULT_LOCATION_ID, quantity: new Prisma.Decimal(quantity) },
  });
}

async function currentStock(): Promise<number> {
  const stock = await prisma.stock.findUnique({
    where: { ingredientId_locationId: { ingredientId, locationId: DEFAULT_LOCATION_ID } },
  });
  return stock ? Number(stock.quantity) : 0;
}

async function countsForVariant() {
  const saleItems = await prisma.saleItem.findMany({ where: { variantId } });
  const saleIds = [...new Set(saleItems.map((i) => i.saleId))];
  const movements = await prisma.stockMovement.count({ where: { ingredientId } });
  return { sales: saleIds.length, saleItems: saleItems.length, movements };
}

async function resetBetweenScenarios() {
  await prisma.stockMovement.deleteMany({ where: { ingredientId } });
  const saleItems = await prisma.saleItem.findMany({ where: { variantId }, select: { saleId: true } });
  const saleIds = [...new Set(saleItems.map((i) => i.saleId))];
  await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
}

async function scenarioA_doubleClickSameOrder() {
  console.log("\n=== A. Double-click: two concurrent createSale() calls, SAME clientRequestId, autoAccept ===");
  await resetBetweenScenarios();
  await setStock(100);

  const items = [{ variantId, quantity: 1 }];
  const key = `${MARK}-scenario-A-${Date.now()}`;
  const [r1, r2] = await Promise.allSettled([
    createSale(DEFAULT_LOCATION_ID, adminId, items, 1000, true, undefined, key),
    createSale(DEFAULT_LOCATION_ID, adminId, items, 1000, true, undefined, key),
  ]);
  console.log("Result 1:", r1.status, r1.status === "rejected" ? (r1 as any).reason.message : (r1 as any).value.id);
  console.log("Result 2:", r2.status, r2.status === "rejected" ? (r2 as any).reason.message : (r2 as any).value.id);
  if (r1.status === "fulfilled" && r2.status === "fulfilled") {
    console.log("Same sale id returned to both callers:", (r1 as any).value.id === (r2 as any).value.id);
  }

  const counts = await countsForVariant();
  const stockLeft = await currentStock();
  console.log(`Sales created: ${counts.sales} | SaleItems: ${counts.saleItems} | StockMovements: ${counts.movements} | stock left: ${stockLeft} (started at 100, one order of 1 -> 99 expected)`);
  const ok = counts.sales === 1 && counts.saleItems === 1 && counts.movements === 1 && stockLeft === 99;
  console.log(ok ? "PASS (exactly one order, one deduction)" : `FAIL — duplicate order (expected 1 sale, got ${counts.sales})`);
}

async function scenarioB_retryAfterDelay() {
  console.log("\n=== B. Retry with the SAME clientRequestId after the first call already succeeded ===");
  await resetBetweenScenarios();
  await setStock(100);

  const items = [{ variantId, quantity: 1 }];
  const key = `${MARK}-scenario-B-${Date.now()}`;
  const first = await createSale(DEFAULT_LOCATION_ID, adminId, items, 1000, true, undefined, key);
  await new Promise((r) => setTimeout(r, 50));
  const retry = await createSale(DEFAULT_LOCATION_ID, adminId, items, 1000, true, undefined, key);
  console.log("First:", first.id, "Retry:", retry.id, "Same sale returned:", first.id === retry.id);

  const counts = await countsForVariant();
  const stockLeft = await currentStock();
  console.log(`Sales: ${counts.sales} | StockMovements: ${counts.movements} | stock left: ${stockLeft} (started at 100)`);
  const ok = first.id === retry.id && counts.sales === 1 && stockLeft === 99;
  console.log(ok ? "PASS (retry returned the original sale, no second deduction)" : "FAIL");
}

async function scenarioD_twoRealOrdersSameCart() {
  console.log("\n=== D. Two DIFFERENT real orders with an identical cart (different clientRequestId each) ===");
  await resetBetweenScenarios();
  await setStock(100);

  const items = [{ variantId, quantity: 1 }];
  const [r1, r2] = await Promise.all([
    createSale(DEFAULT_LOCATION_ID, adminId, items, 1000, true, undefined, `${MARK}-D-1-${Date.now()}`),
    createSale(DEFAULT_LOCATION_ID, sellerId, items, 1000, true, undefined, `${MARK}-D-2-${Date.now()}`),
  ]);
  console.log("Order 1:", r1.id, "Order 2:", r2.id, "Distinct sales:", r1.id !== r2.id);

  const counts = await countsForVariant();
  const stockLeft = await currentStock();
  console.log(`Sales: ${counts.sales} | StockMovements: ${counts.movements} | stock left: ${stockLeft} (started at 100, two legitimate orders -> 98 expected)`);
  const ok = r1.id !== r2.id && counts.sales === 2 && stockLeft === 98;
  console.log(ok ? "PASS (two independent orders, not incorrectly merged)" : "FAIL");
}

async function scenarioE_insufficientStockRace() {
  console.log("\n=== E. Insufficient stock race: stock=1, two concurrent orders each needing 1 ===");
  await resetBetweenScenarios();
  await setStock(1);

  const items = [{ variantId, quantity: 1 }];
  const [r1, r2] = await Promise.allSettled([
    createSale(DEFAULT_LOCATION_ID, adminId, items, 1000, true),
    createSale(DEFAULT_LOCATION_ID, adminId, items, 1000, true),
  ]);
  const results = [r1, r2];
  const fulfilled = results.filter((r) => r.status === "fulfilled").length;
  const rejected = results.filter((r) => r.status === "rejected");
  console.log("Fulfilled:", fulfilled, "Rejected:", rejected.length, rejected.map((r: any) => r.reason?.message));

  const counts = await countsForVariant();
  const stockLeft = await currentStock();
  console.log(`Sales created: ${counts.sales} | SaleItems: ${counts.saleItems} | StockMovements: ${counts.movements} | stock left: ${stockLeft} (started at 1)`);
  const ok = fulfilled === 1 && stockLeft === 0 && counts.sales === 1;
  console.log(ok ? "PASS (exactly one order succeeded, stock at 0, no negative stock)" : "FAIL");
}

async function scenarioF_partialFailureRollback() {
  console.log("\n=== F. Partial failure mid-transaction: second cart line has insufficient stock ===");
  await resetBetweenScenarios();
  await setStock(1); // enough for ONE unit, cart asks for 2 of the same variant in one order

  const items = [{ variantId, quantity: 2 }];
  try {
    await createSale(DEFAULT_LOCATION_ID, adminId, items, 2000, true);
    console.log("FAIL — expected INSUFFICIENT_STOCK to be thrown");
  } catch (err: any) {
    console.log("Threw as expected:", err.message);
  }

  const counts = await countsForVariant();
  const stockLeft = await currentStock();
  console.log(`After failed attempt — Sales: ${counts.sales} | SaleItems: ${counts.saleItems} | StockMovements: ${counts.movements} | stock left: ${stockLeft} (started at 1, must still be 1)`);
  const ok = counts.sales === 0 && counts.saleItems === 0 && counts.movements === 0 && stockLeft === 1;
  console.log(ok ? "PASS (whole transaction rolled back, nothing partial left behind)" : "FAIL");
}

async function scenarioWaiter_doubleAccept() {
  console.log("\n=== Waiter flow: two concurrent acceptSale() calls for the same PENDING sale ===");
  await resetBetweenScenarios();
  await setStock(100);

  // Seller sends an order (autoAccept=false) — stays PENDING, nothing deducted yet.
  const sent = await createSale(DEFAULT_LOCATION_ID, sellerId, [{ variantId, quantity: 1 }], undefined, false, undefined as unknown as string).catch(async (e) => {
    // createSale requires a tableId for non-autoAccept; create one on the fly if needed.
    const table = await prisma.table.create({ data: { number: 999_001, locationId: DEFAULT_LOCATION_ID, isActive: true } });
    return createSale(DEFAULT_LOCATION_ID, sellerId, [{ variantId, quantity: 1 }], undefined, false, table.id);
  });
  console.log("Sale sent as PENDING:", sent.id, sent.status);

  const [r1, r2] = await Promise.allSettled([
    acceptSale(DEFAULT_LOCATION_ID, sent.id, 1000),
    acceptSale(DEFAULT_LOCATION_ID, sent.id, 1000),
  ]);
  console.log("Accept 1:", r1.status, r1.status === "rejected" ? r1.reason.message : r1.value.status);
  console.log("Accept 2:", r2.status, r2.status === "rejected" ? r2.reason.message : r2.value.status);

  const movements = await prisma.stockMovement.count({ where: { ingredientId, referenceId: { in: await prisma.saleItem.findMany({ where: { saleId: sent.id } }).then((its) => its.map((i) => i.id)) } } });
  const stockLeft = await currentStock();
  console.log(`StockMovements for this sale's items: ${movements} (must be 1, not 2) | stock left: ${stockLeft} (started at 100, exactly one deduction of 1 expected -> 99)`);
  const ok = movements === 1 && stockLeft === 99;
  console.log(ok ? "PASS (accepted exactly once, deducted exactly once)" : `FAIL — double-accept / double-deduction (movements=${movements}, stock=${stockLeft})`);

  await prisma.sale.deleteMany({ where: { id: sent.id } });
}

async function cleanup() {
  await prisma.stockMovement.deleteMany({ where: { ingredientId } });
  const saleItems = await prisma.saleItem.findMany({ where: { variantId }, select: { saleId: true } });
  const saleIds = [...new Set(saleItems.map((i) => i.saleId))];
  await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
  await prisma.table.deleteMany({ where: { number: 999_001, locationId: DEFAULT_LOCATION_ID } });
  await prisma.recipe.deleteMany({ where: { ingredientId } });
  await prisma.stock.deleteMany({ where: { ingredientId } });
  await prisma.ingredient.deleteMany({ where: { id: ingredientId } });
  await prisma.productVariant.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
}

async function main() {
  console.log(`Connected DB: ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ":***@")}`);
  await setup();
  try {
    await scenarioA_doubleClickSameOrder();
    await scenarioB_retryAfterDelay();
    await scenarioD_twoRealOrdersSameCart();
    await scenarioE_insufficientStockRace();
    await scenarioF_partialFailureRollback();
    await scenarioWaiter_doubleAccept();
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
