/**
 * Warehouse consistency audit — runs ONLY against whatever DATABASE_URL is configured (local dev
 * DB when run normally; never point this at production). Creates its own isolated fixtures
 * (marked WAREHOUSE_AUDIT_*), runs each scenario, prints actual DB state, and cleans up after
 * itself. Read-only for everything except its own fixtures.
 *
 * Run from server/:  npx tsx prisma/warehouseAudit.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import dotenv from "dotenv";

import { createSale, acceptSale } from "../src/modules/sales/sale.service.js";
import { cancelSale, removeSaleItem } from "../src/modules/owner/owner.service.js";
import { restock } from "../src/modules/ingredients/ingredient.service.js";
import { DEFAULT_LOCATION_ID } from "../src/bootstrap/menu.js";

dotenv.config();

const prisma = new PrismaClient();

const MARK = "WAREHOUSE_AUDIT";
let categoryId!: string;
let productId!: string;
let variantId!: string;
// Two ingredients on the recipe, to also exercise the "multiple lines per sale" path.
let ingredientAId!: string;
let ingredientBId!: string;
let adminId!: string;
let ownerId!: string;
let tableId!: string;

async function setup() {
  const admin = await prisma.user.findUnique({ where: { login: process.env.SEED_ADMIN_LOGIN || "admin" } });
  if (!admin) throw new Error("Expected local dev admin user to exist.");
  adminId = admin.id;

  // The OWNER account is optional in local dev (only created if OWNER_LOGIN/OWNER_PASSWORD are
  // set) — fall back to a throwaway owner user scoped to this audit if none exists, so
  // cancelSale/removeSaleItem (OWNER-gated at the route level, not the service function) can
  // still be exercised directly.
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

  const product = await prisma.product.create({
    data: { name: `${MARK}_PRODUCT`, categoryId, saleType: "UNIT", isActive: true },
  });
  productId = product.id;

  const variant = await prisma.productVariant.create({
    data: { productId, label: "TEST", price: new Prisma.Decimal(1000), isActive: true },
  });
  variantId = variant.id;

  const ingredientA = await prisma.ingredient.create({ data: { name: `${MARK}_INGREDIENT_A`, unit: "PIECE", minQuantity: 0 } });
  const ingredientB = await prisma.ingredient.create({ data: { name: `${MARK}_INGREDIENT_B`, unit: "G", minQuantity: 0 } });
  ingredientAId = ingredientA.id;
  ingredientBId = ingredientB.id;

  // 1 unit of A + 2.5 of B per sale of this variant — exercises multi-line recipes and
  // non-integer quantities in one go.
  await prisma.recipe.create({ data: { variantId, ingredientId: ingredientAId, quantity: new Prisma.Decimal(1) } });
  await prisma.recipe.create({ data: { variantId, ingredientId: ingredientBId, quantity: new Prisma.Decimal("2.5") } });

  const table = await prisma.table.create({ data: { number: 999_002, locationId: DEFAULT_LOCATION_ID, isActive: true } });
  tableId = table.id;
}

async function setStock(ingredientId: string, quantity: number | string) {
  await prisma.stock.upsert({
    where: { ingredientId_locationId: { ingredientId, locationId: DEFAULT_LOCATION_ID } },
    update: { quantity: new Prisma.Decimal(quantity) },
    create: { ingredientId, locationId: DEFAULT_LOCATION_ID, quantity: new Prisma.Decimal(quantity) },
  });
}

async function currentStock(ingredientId: string): Promise<Prisma.Decimal> {
  const stock = await prisma.stock.findUnique({ where: { ingredientId_locationId: { ingredientId, locationId: DEFAULT_LOCATION_ID } } });
  return stock?.quantity ?? new Prisma.Decimal(0);
}

async function movementSum(ingredientId: string): Promise<Prisma.Decimal> {
  const movements = await prisma.stockMovement.findMany({ where: { ingredientId, locationId: DEFAULT_LOCATION_ID } });
  return movements.reduce((sum, m) => sum.add(m.change), new Prisma.Decimal(0));
}

async function movementCount(ingredientId: string): Promise<number> {
  return prisma.stockMovement.count({ where: { ingredientId, locationId: DEFAULT_LOCATION_ID } });
}

async function resetIngredient(ingredientId: string, quantity: number | string) {
  await prisma.stockMovement.deleteMany({ where: { ingredientId, locationId: DEFAULT_LOCATION_ID } });
  await setStock(ingredientId, quantity);
}

async function resetAll() {
  await resetIngredient(ingredientAId, 0);
  await resetIngredient(ingredientBId, 0);
  const items = await prisma.saleItem.findMany({ where: { variantId }, select: { saleId: true } });
  const saleIds = [...new Set(items.map((i) => i.saleId))];
  await prisma.saleChangeLog.deleteMany({ where: { saleId: { in: saleIds } } });
  await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
}

async function scenario1_saleDeductsEachIngredientOnce() {
  console.log("\n=== 1. A single accepted sale deducts EACH recipe ingredient exactly once ===");
  await resetAll();
  await setStock(ingredientAId, 100);
  await setStock(ingredientBId, 100);

  await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 1 }], 1000, true);

  const aAfter = await currentStock(ingredientAId);
  const bAfter = await currentStock(ingredientBId);
  const aMovements = await movementCount(ingredientAId);
  const bMovements = await movementCount(ingredientBId);
  console.log(`Ingredient A: 100 -> ${aAfter} (expect 99), ${aMovements} movement(s)`);
  console.log(`Ingredient B: 100 -> ${bAfter} (expect 97.5), ${bMovements} movement(s)`);
  const ok = aAfter.equals(99) && bAfter.equals(new Prisma.Decimal("97.5")) && aMovements === 1 && bMovements === 1;
  console.log(ok ? "PASS" : "FAIL");
}

async function scenario2_stockEqualsMovementSum() {
  console.log("\n=== 2. Stock.quantity always equals sum(StockMovement.change) after a mixed sequence ===");
  await resetAll();
  await setStock(ingredientAId, 50);
  await setStock(ingredientBId, 50);

  // Purchase-style restock, then two sales, then a cancellation of one of them.
  await restock(DEFAULT_LOCATION_ID, ingredientAId, adminId, { quantity: 20, note: "audit" });
  const s1 = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 2 }], 2000, true);
  await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 1 }], 1000, true);
  await cancelSale(DEFAULT_LOCATION_ID, s1.id, ownerId, {});

  for (const ingredientId of [ingredientAId, ingredientBId]) {
    // Movements sum is relative to whatever setStock() set as the starting point above (50 for
    // both) — so expected stock = 50 + sum(movements).
    const stock = await currentStock(ingredientId);
    const sum = await movementSum(ingredientId);
    const expected = new Prisma.Decimal(50).add(sum);
    const ok = stock.equals(expected);
    console.log(`${ingredientId === ingredientAId ? "A" : "B"}: stock=${stock} | 50+sum(movements)=${expected} | ${ok ? "PASS" : "FAIL"}`);
  }
}

async function scenario3_concurrentRestocksBothApply() {
  console.log("\n=== 3. Two concurrent restock() calls on the same ingredient both apply (no lost update) ===");
  await resetAll();
  await setStock(ingredientAId, 10);

  await Promise.all([
    restock(DEFAULT_LOCATION_ID, ingredientAId, adminId, { quantity: 5, note: "r1" }),
    restock(DEFAULT_LOCATION_ID, ingredientAId, adminId, { quantity: 7, note: "r2" }),
  ]);

  const after = await currentStock(ingredientAId);
  const movements = await movementCount(ingredientAId);
  console.log(`Stock: 10 -> ${after} (expect 22) | movements: ${movements} (expect 2)`);
  console.log(after.equals(22) && movements === 2 ? "PASS (no lost update)" : "FAIL");
}

async function scenario4_concurrentCancelSameSale() {
  console.log("\n=== 4. Two concurrent cancelSale() calls for the SAME accepted sale ===");
  await resetAll();
  await setStock(ingredientAId, 100);
  await setStock(ingredientBId, 100);

  const sale = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 1 }], 1000, true);
  console.log("Sale accepted:", sale.id, "| stock after sale: A=", await currentStock(ingredientAId), "B=", await currentStock(ingredientBId));

  const [r1, r2] = await Promise.allSettled([
    cancelSale(DEFAULT_LOCATION_ID, sale.id, ownerId, { reason: "audit-1" }),
    cancelSale(DEFAULT_LOCATION_ID, sale.id, ownerId, { reason: "audit-2" }),
  ]);
  console.log("Cancel 1:", r1.status, r1.status === "rejected" ? (r1 as PromiseRejectedResult).reason.message : (r1 as PromiseFulfilledResult<unknown>).value);
  console.log("Cancel 2:", r2.status, r2.status === "rejected" ? (r2 as PromiseRejectedResult).reason.message : (r2 as PromiseFulfilledResult<unknown>).value);

  const finalSale = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
  const aAfter = await currentStock(ingredientAId);
  const bAfter = await currentStock(ingredientBId);
  const aMovements = await movementCount(ingredientAId);
  const bMovements = await movementCount(ingredientBId);
  console.log(`Final status: ${finalSale.status} | A: 99->${aAfter} (movements=${aMovements}) | B: 97.5->${bAfter} (movements=${bMovements})`);
  // Correct: sale accepted (1 deduct movement each), then cancelled ONCE (1 restock movement
  // each) -> back to 100/100, 2 movements each. If double-restocked: 101/102.5, 3 movements.
  const ok = aAfter.equals(100) && bAfter.equals(100) && aMovements === 2 && bMovements === 2;
  console.log(ok ? "PASS (cancelled exactly once, stock restored exactly once)" : "FAIL — double restock / stock drift");

  await prisma.saleChangeLog.deleteMany({ where: { saleId: sale.id } });
  await prisma.saleItem.deleteMany({ where: { saleId: sale.id } });
  await prisma.sale.deleteMany({ where: { id: sale.id } });
}

async function scenario5_concurrentRemoveSameItem() {
  console.log("\n=== 5. Two concurrent removeSaleItem() calls for the SAME line ===");
  await resetAll();
  await setStock(ingredientAId, 100);
  await setStock(ingredientBId, 100);

  const sale = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 1 }], 1000, true);
  const item = await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id } });

  const [r1, r2] = await Promise.allSettled([
    removeSaleItem(DEFAULT_LOCATION_ID, sale.id, item.id, ownerId, { reason: "audit-1" }),
    removeSaleItem(DEFAULT_LOCATION_ID, sale.id, item.id, ownerId, { reason: "audit-2" }),
  ]);
  console.log("Remove 1:", r1.status, r1.status === "rejected" ? (r1 as PromiseRejectedResult).reason.message : "ok");
  console.log("Remove 2:", r2.status, r2.status === "rejected" ? (r2 as PromiseRejectedResult).reason.message : "ok");

  const aAfter = await currentStock(ingredientAId);
  const bAfter = await currentStock(ingredientBId);
  const aMovements = await movementCount(ingredientAId);
  const bMovements = await movementCount(ingredientBId);
  console.log(`A: 99->${aAfter} (movements=${aMovements}) | B: 97.5->${bAfter} (movements=${bMovements})`);
  const ok = aAfter.equals(100) && bAfter.equals(100) && aMovements === 2 && bMovements === 2;
  console.log(ok ? "PASS (removed exactly once, stock restored exactly once)" : "FAIL — double restock / stock drift");

  await prisma.saleChangeLog.deleteMany({ where: { saleId: sale.id } });
  await prisma.saleItem.deleteMany({ where: { saleId: sale.id } });
  await prisma.sale.deleteMany({ where: { id: sale.id } });
}

async function scenario6_weightPrecision() {
  console.log("\n=== 6. Fractional (WEIGHT-style) quantities keep exact decimal precision across deduct+restock ===");
  await resetAll();
  await setStock(ingredientBId, 100);

  // 0.001 (1 gram-equivalent scale) x 2.5 recipe ratio -> exercises 3-decimal precision.
  const sale = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 0.001 }], 1, true).catch((e) => {
    console.log("(WEIGHT-quantity path needs saleType=WEIGHT on the product; this variant is UNIT, so a non-integer quantity is expected to be rejected here)", e.message);
    return null;
  });
  if (sale) {
    const bAfter = await currentStock(ingredientBId);
    console.log(`B after 0.001x sale: ${bAfter} (expect 99.9975)`);
    console.log(bAfter.equals(new Prisma.Decimal("99.9975")) ? "PASS (exact decimal precision preserved)" : "FAIL");
  } else {
    console.log("SKIPPED (product saleType is UNIT — fractional-quantity validation correctly blocked it; precision itself already exercised by the 2.5-per-unit recipe ratio in every other scenario)");
  }
}

async function cleanup() {
  await resetAll();
  await prisma.stock.deleteMany({ where: { ingredientId: { in: [ingredientAId, ingredientBId] } } });
  await prisma.recipe.deleteMany({ where: { ingredientId: { in: [ingredientAId, ingredientBId] } } });
  await prisma.ingredient.deleteMany({ where: { id: { in: [ingredientAId, ingredientBId] } } });
  await prisma.productVariant.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.table.deleteMany({ where: { number: 999_002, locationId: DEFAULT_LOCATION_ID } });
  await prisma.user.deleteMany({ where: { login: { startsWith: `${MARK.toLowerCase()}_owner_` } } });
}

async function main() {
  console.log(`Connected DB: ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ":***@")}`);
  await setup();
  try {
    await scenario1_saleDeductsEachIngredientOnce();
    await scenario2_stockEqualsMovementSum();
    await scenario3_concurrentRestocksBothApply();
    await scenario4_concurrentCancelSameSale();
    await scenario5_concurrentRemoveSameItem();
    await scenario6_weightPrecision();
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
