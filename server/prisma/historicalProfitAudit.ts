/**
 * Historical profit / cost-snapshot correctness audit — TEST DB only (whatever DATABASE_URL is
 * configured; never point this at production). Proves the fix for the confirmed bug: profit on
 * an already-closed sale used to drift whenever a later purchase changed Ingredient.avgUnitCost,
 * because cost was computed live instead of frozen at sale time.
 *
 * Run from server/:  npx tsx prisma/historicalProfitAudit.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import dotenv from "dotenv";

import { createSale, acceptSale } from "../src/modules/sales/sale.service.js";
import { addSaleItem, cancelSale, removeSaleItem, updateSaleItem } from "../src/modules/owner/owner.service.js";
import { getSaleDetail } from "../src/modules/reports/report.service.js";
import { computeProfitStats } from "../src/modules/reports/report.costing.js";
import { DEFAULT_LOCATION_ID } from "../src/bootstrap/menu.js";

dotenv.config();

const prisma = new PrismaClient();
const MARK = "HIST_AUDIT";

let categoryId!: string;
let adminId!: string;

const cleanupIds = { products: new Set<string>(), ingredients: new Set<string>(), sales: new Set<string>() };

async function setup() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { login: process.env.SEED_ADMIN_LOGIN || "admin" } });
  adminId = admin.id;
  const category = await prisma.category.create({ data: { name: `${MARK}_CATEGORY` } });
  categoryId = category.id;
}

async function makeProductWithRecipe(label: string, ingredientCost: number, recipeQty: number) {
  const ingredient = await prisma.ingredient.create({ data: { name: `${MARK}_ING_${label}`, unit: "PIECE", avgUnitCost: new Prisma.Decimal(ingredientCost) } });
  cleanupIds.ingredients.add(ingredient.id);
  const product = await prisma.product.create({ data: { name: `${MARK}_PRODUCT_${label}`, categoryId, saleType: "UNIT", isActive: true } });
  cleanupIds.products.add(product.id);
  const variant = await prisma.productVariant.create({ data: { productId: product.id, label: "std", price: new Prisma.Decimal(1000), isActive: true } });
  await prisma.recipe.create({ data: { variantId: variant.id, ingredientId: ingredient.id, quantity: new Prisma.Decimal(recipeQty) } });
  await prisma.stock.create({ data: { ingredientId: ingredient.id, locationId: DEFAULT_LOCATION_ID, quantity: new Prisma.Decimal(100000) } });
  return { ingredientId: ingredient.id, productId: product.id, variantId: variant.id };
}

async function makeProductNoRecipe(label: string) {
  const product = await prisma.product.create({ data: { name: `${MARK}_PRODUCT_${label}`, categoryId, saleType: "UNIT", isActive: true } });
  cleanupIds.products.add(product.id);
  const variant = await prisma.productVariant.create({ data: { productId: product.id, label: "std", price: new Prisma.Decimal(1000), isActive: true } });
  return { productId: product.id, variantId: variant.id };
}

function assertEqual(label: string, actual: string, expected: string) {
  const ok = actual === expected;
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}: actual=${actual} expected=${expected}`);
  return ok;
}

async function scenario1_historicalProfitStableAcrossCostChange() {
  console.log("\n=== 1. New sale's historical profit stays fixed after avgUnitCost changes later ===");
  // recipeQty=2, cost A=100/unit -> unitCostSnapshot should be 200
  const { ingredientId, variantId } = await makeProductWithRecipe("A", 100, 2);
  const sale = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 1 }], 1000, true);
  cleanupIds.sales.add(sale.id);

  const item = await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id } });
  console.log(`Captured at sale time: unitCostSnapshot=${item.unitCostSnapshot} costSnapshot=${item.costSnapshot} hasCostSnapshot=${item.hasCostSnapshot}`);

  const detailBefore = await getSaleDetail(DEFAULT_LOCATION_ID, sale.id);
  const profitBefore = detailBefore.totalProfit;
  console.log(`Profit BEFORE cost change: ${profitBefore} (estimated=${detailBefore.profitEstimated})`);

  // Change the SAME ingredient's avgUnitCost — simulates a new purchase moving the weighted average.
  await prisma.ingredient.update({ where: { id: ingredientId }, data: { avgUnitCost: new Prisma.Decimal(9000) } });

  const detailAfter = await getSaleDetail(DEFAULT_LOCATION_ID, sale.id);
  const profitAfter = detailAfter.totalProfit;
  console.log(`Profit AFTER cost change:  ${profitAfter} (estimated=${detailAfter.profitEstimated})`);

  return assertEqual("historical profit unchanged after later cost change", profitAfter, profitBefore);
}

async function scenario2_newSaleAfterChangeUsesNewCost() {
  console.log("\n=== 2. A DIFFERENT new sale, created AFTER the cost change, freezes the NEW cost (not stuck on the old one) ===");
  const { ingredientId, variantId } = await makeProductWithRecipe("B", 50, 1); // unitCost=50
  const saleAtOldCost = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 1 }], 1000, true);
  cleanupIds.sales.add(saleAtOldCost.id);
  const itemOld = await prisma.saleItem.findFirstOrThrow({ where: { saleId: saleAtOldCost.id } });

  await prisma.ingredient.update({ where: { id: ingredientId }, data: { avgUnitCost: new Prisma.Decimal(300) } });

  const saleAtNewCost = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 1 }], 1000, true);
  cleanupIds.sales.add(saleAtNewCost.id);
  const itemNew = await prisma.saleItem.findFirstOrThrow({ where: { saleId: saleAtNewCost.id } });

  console.log(`Old sale's frozen unitCostSnapshot: ${itemOld.unitCostSnapshot} (expect 50, unchanged)`);
  console.log(`New sale's frozen unitCostSnapshot: ${itemNew.unitCostSnapshot} (expect 300)`);
  const oldOk = itemOld.unitCostSnapshot?.toString() === "50";
  const newOk = itemNew.unitCostSnapshot?.toString() === "300";
  console.log(`${oldOk ? "PASS" : "FAIL"} — old sale kept its own historical cost`);
  console.log(`${newOk ? "PASS" : "FAIL"} — new sale captured the current cost at ITS OWN sale time`);
  return oldOk && newOk;
}

async function scenario3_productWithNoCostData() {
  console.log("\n=== 3. Product with NO recipe at all — no snapshot, honestly marked estimated/no-data, never a false 100% margin ===");
  const { variantId } = await makeProductNoRecipe("NoCost");
  const sale = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 1 }], 1000, true);
  cleanupIds.sales.add(sale.id);

  const item = await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id } });
  const detail = await getSaleDetail(DEFAULT_LOCATION_ID, sale.id);
  const line = detail.items[0];
  console.log(`hasCostSnapshot(DB)=${item.hasCostSnapshot} | API: cost=${line.cost} hasCostData=${line.hasCostData} costIsEstimated=${line.costIsEstimated}`);
  const ok = item.hasCostSnapshot === false && line.hasCostData === false && line.costIsEstimated === true;
  console.log(`${ok ? "PASS" : "FAIL"} — no-recipe product never presented as a real 0-cost/100%-margin figure`);
  return ok;
}

async function scenario4_partiallyFilledRecipeCost() {
  console.log("\n=== 4. Recipe with two ingredients, one never purchased (avgUnitCost=0) — still counts as real snapshot data ===");
  const ingA = await prisma.ingredient.create({ data: { name: `${MARK}_ING_PartA`, unit: "PIECE", avgUnitCost: new Prisma.Decimal(40) } });
  const ingB = await prisma.ingredient.create({ data: { name: `${MARK}_ING_PartB`, unit: "PIECE", avgUnitCost: new Prisma.Decimal(0) } }); // default, never purchased
  cleanupIds.ingredients.add(ingA.id);
  cleanupIds.ingredients.add(ingB.id);
  const product = await prisma.product.create({ data: { name: `${MARK}_PRODUCT_Partial`, categoryId, saleType: "UNIT", isActive: true } });
  cleanupIds.products.add(product.id);
  const variant = await prisma.productVariant.create({ data: { productId: product.id, label: "std", price: new Prisma.Decimal(1000), isActive: true } });
  await prisma.recipe.create({ data: { variantId: variant.id, ingredientId: ingA.id, quantity: new Prisma.Decimal(1) } });
  await prisma.recipe.create({ data: { variantId: variant.id, ingredientId: ingB.id, quantity: new Prisma.Decimal(1) } });
  await prisma.stock.create({ data: { ingredientId: ingA.id, locationId: DEFAULT_LOCATION_ID, quantity: new Prisma.Decimal(1000) } });
  await prisma.stock.create({ data: { ingredientId: ingB.id, locationId: DEFAULT_LOCATION_ID, quantity: new Prisma.Decimal(1000) } });

  const sale = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId: variant.id, quantity: 1 }], 1000, true);
  cleanupIds.sales.add(sale.id);
  const item = await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id } });
  console.log(`unitCostSnapshot=${item.unitCostSnapshot} (expect 40, since ingB contributes 0) hasCostSnapshot=${item.hasCostSnapshot} (expect true)`);
  const ok = item.unitCostSnapshot?.toString() === "40" && item.hasCostSnapshot === true;
  console.log(`${ok ? "PASS" : "FAIL"} — partial-cost recipe still recorded as real (non-estimated) data`);
  return ok;
}

async function scenario5_removedItemExcludedFromProfit() {
  console.log("\n=== 5. A removed item's cost snapshot doesn't leak into profit totals ===");
  const { variantId } = await makeProductWithRecipe("Removed", 20, 1);
  const sale = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 1 }], 1000, true);
  cleanupIds.sales.add(sale.id);
  const added = await addSaleItem(DEFAULT_LOCATION_ID, sale.id, adminId, { variantId, quantity: 2 });
  const addedItem = added.items.find((i) => i.quantity === "2") ?? (await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id, quantity: new Prisma.Decimal(2) } }));

  const beforeRemove = await getSaleDetail(DEFAULT_LOCATION_ID, sale.id);
  await removeSaleItem(DEFAULT_LOCATION_ID, sale.id, addedItem.id, adminId, {});
  const afterRemove = await getSaleDetail(DEFAULT_LOCATION_ID, sale.id);

  console.log(`totalCost before remove=${beforeRemove.totalCost}, after remove=${afterRemove.totalCost}`);
  const ok = Number(afterRemove.totalCost) < Number(beforeRemove.totalCost) && afterRemove.items.length === 1;
  console.log(`${ok ? "PASS" : "FAIL"} — removed item's cost correctly dropped out of the sale's totals`);
  return ok;
}

async function scenario6_cancelledSaleExcludedFromDashboard() {
  console.log("\n=== 6. A cancelled sale never counts toward profit stats ===");
  const { variantId } = await makeProductWithRecipe("Cancelled", 30, 1);
  const before = await computeProfitStats(DEFAULT_LOCATION_ID);
  const sale = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 1 }], 1000, true);
  cleanupIds.sales.add(sale.id);
  await cancelSale(DEFAULT_LOCATION_ID, sale.id, adminId, {});
  const after = await computeProfitStats(DEFAULT_LOCATION_ID);
  console.log(`all-time revenue before=${before.revenue}, after cancelled sale=${after.revenue} (expect unchanged)`);
  const ok = before.revenue === after.revenue && before.cost === after.cost;
  console.log(`${ok ? "PASS" : "FAIL"} — cancelled sale did not move all-time profit stats`);
  return ok;
}

async function scenario7_addSaleItemGetsItsOwnFreshSnapshot() {
  console.log("\n=== 7. addSaleItem freezes cost at ITS OWN moment, independent of the original sale's snapshot ===");
  const { ingredientId, variantId } = await makeProductWithRecipe("AddLater", 10, 1);
  const sale = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 1 }], 1000, true);
  cleanupIds.sales.add(sale.id);
  const originalItem = await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id } });

  await prisma.ingredient.update({ where: { id: ingredientId }, data: { avgUnitCost: new Prisma.Decimal(700) } });
  await addSaleItem(DEFAULT_LOCATION_ID, sale.id, adminId, { variantId, quantity: 1 });
  const addedItem = await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id, id: { not: originalItem.id } } });

  console.log(`original item unitCostSnapshot=${originalItem.unitCostSnapshot} (expect 10)`);
  console.log(`added item unitCostSnapshot=${addedItem.unitCostSnapshot} (expect 700 — cost at the moment it was added)`);
  const ok = originalItem.unitCostSnapshot?.toString() === "10" && addedItem.unitCostSnapshot?.toString() === "700";
  console.log(`${ok ? "PASS" : "FAIL"}`);
  return ok;
}

async function scenario8_fractionalQuantityWeightType() {
  console.log("\n=== 8. Fractional (WEIGHT) quantity — costSnapshot scales precisely, no rounding drift ===");
  const ingredient = await prisma.ingredient.create({ data: { name: `${MARK}_ING_Weight`, unit: "G", avgUnitCost: new Prisma.Decimal("0.08") } });
  cleanupIds.ingredients.add(ingredient.id);
  const product = await prisma.product.create({ data: { name: `${MARK}_PRODUCT_Weight`, categoryId, saleType: "WEIGHT", isActive: true } });
  cleanupIds.products.add(product.id);
  const variant = await prisma.productVariant.create({ data: { productId: product.id, label: "kg", price: new Prisma.Decimal("500") } });
  await prisma.recipe.create({ data: { variantId: variant.id, ingredientId: ingredient.id, quantity: new Prisma.Decimal(1) } }); // 1g ingredient per 1g sold
  await prisma.stock.create({ data: { ingredientId: ingredient.id, locationId: DEFAULT_LOCATION_ID, quantity: new Prisma.Decimal(1000000) } });

  const sale = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId: variant.id, quantity: 137.5 }], 100000, true);
  cleanupIds.sales.add(sale.id);
  const item = await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id } });
  console.log(`quantity=${item.quantity} unitCostSnapshot=${item.unitCostSnapshot} costSnapshot=${item.costSnapshot} (expect 137.5 * 0.08 = 11.00)`);
  const ok = item.costSnapshot?.toString() === "11.00" || item.costSnapshot?.toString() === "11";
  console.log(`${ok ? "PASS" : "FAIL"}`);
  return ok;
}

async function scenario9_retryDoesNotCreateSecondSnapshot() {
  console.log("\n=== 9. Retrying createSale with the same clientRequestId never creates a second SaleItem/snapshot ===");
  const { variantId } = await makeProductWithRecipe("Retry", 15, 1);
  const key = `${MARK}_retry_key_${Date.now()}`;

  const first = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 1 }], 1000, true, undefined, key);
  cleanupIds.sales.add(first.id);
  const second = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 1 }], 1000, true, undefined, key);

  const items = await prisma.saleItem.findMany({ where: { variantId, sale: { clientRequestId: key } } });
  console.log(`first.id=${first.id} second.id=${second.id} (expect identical) | SaleItem rows for this key: ${items.length} (expect 1)`);
  const ok = first.id === second.id && items.length === 1 && items[0].unitCostSnapshot?.toString() === "15";
  console.log(`${ok ? "PASS" : "FAIL"} — retry returned the same sale, no duplicate item/snapshot was ever created`);
  return ok;
}

async function scenario10_pendingOrderSnapshotsAtAcceptTime() {
  console.log("\n=== 10. A waiter's PENDING order has NO snapshot until accepted — then freezes cost as of ACCEPT time ===");
  const { ingredientId, variantId } = await makeProductWithRecipe("Pending", 25, 1);
  const table = await prisma.table.create({ data: { locationId: DEFAULT_LOCATION_ID, number: 9001, isActive: true } });

  const pending = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 1 }], undefined, false, table.id);
  cleanupIds.sales.add(pending.id);
  const itemAtCreate = await prisma.saleItem.findFirstOrThrow({ where: { saleId: pending.id } });
  console.log(`At creation (PENDING, stock not yet touched): hasCostSnapshot=${itemAtCreate.hasCostSnapshot} unitCostSnapshot=${itemAtCreate.unitCostSnapshot} (expect false / null)`);
  const createOk = itemAtCreate.hasCostSnapshot === false && itemAtCreate.unitCostSnapshot === null;

  // Cost moves AFTER the order was sent but BEFORE the admin accepts it — the snapshot should
  // reflect the cost as of ACCEPT (when stock is actually deducted), not as of the original send.
  await prisma.ingredient.update({ where: { id: ingredientId }, data: { avgUnitCost: new Prisma.Decimal(999) } });
  await acceptSale(DEFAULT_LOCATION_ID, pending.id);
  const itemAfterAccept = await prisma.saleItem.findUniqueOrThrow({ where: { id: itemAtCreate.id } });
  console.log(`After accept: hasCostSnapshot=${itemAfterAccept.hasCostSnapshot} unitCostSnapshot=${itemAfterAccept.unitCostSnapshot} (expect true / 999)`);
  const acceptOk = itemAfterAccept.hasCostSnapshot === true && itemAfterAccept.unitCostSnapshot?.toString() === "999";

  await prisma.table.delete({ where: { id: table.id } });
  const ok = createOk && acceptOk;
  console.log(`${ok ? "PASS" : "FAIL"}`);
  return ok;
}

async function scenario11_updateSaleItemPreservesUnitCostOnQuantityChange() {
  console.log("\n=== 11. updateSaleItem: quantity change rescales costSnapshot but keeps unitCostSnapshot frozen; price-only change touches neither ===");
  const { ingredientId, variantId } = await makeProductWithRecipe("UpdateQty", 12, 1);
  const sale = await createSale(DEFAULT_LOCATION_ID, adminId, [{ variantId, quantity: 2 }], 5000, true);
  cleanupIds.sales.add(sale.id);
  const item = await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id } });
  console.log(`initial: quantity=${item.quantity} unitCostSnapshot=${item.unitCostSnapshot} costSnapshot=${item.costSnapshot} (expect 2 / 12 / 24)`);

  // Move the live cost — updateSaleItem must NOT pick this up for an existing line.
  await prisma.ingredient.update({ where: { id: ingredientId }, data: { avgUnitCost: new Prisma.Decimal(500) } });

  await updateSaleItem(DEFAULT_LOCATION_ID, sale.id, item.id, adminId, { quantity: 5 });
  const afterQtyChange = await prisma.saleItem.findUniqueOrThrow({ where: { id: item.id } });
  console.log(`after quantity->5: unitCostSnapshot=${afterQtyChange.unitCostSnapshot} costSnapshot=${afterQtyChange.costSnapshot} (expect unitCostSnapshot STILL 12, costSnapshot=60)`);
  const qtyOk = afterQtyChange.unitCostSnapshot?.toString() === "12" && afterQtyChange.costSnapshot?.toString() === "60";

  await updateSaleItem(DEFAULT_LOCATION_ID, sale.id, item.id, adminId, { unitPrice: 1234 });
  const afterPriceChange = await prisma.saleItem.findUniqueOrThrow({ where: { id: item.id } });
  console.log(`after price-only change: unitCostSnapshot=${afterPriceChange.unitCostSnapshot} costSnapshot=${afterPriceChange.costSnapshot} (expect unchanged: 12 / 60)`);
  const priceOk = afterPriceChange.unitCostSnapshot?.toString() === "12" && afterPriceChange.costSnapshot?.toString() === "60";

  const ok = qtyOk && priceOk;
  console.log(`${ok ? "PASS" : "FAIL"}`);
  return ok;
}

async function cleanup() {
  for (const saleId of cleanupIds.sales) {
    await prisma.saleChangeLog.deleteMany({ where: { saleId } });
    await prisma.saleItem.deleteMany({ where: { saleId } });
  }
  await prisma.sale.deleteMany({ where: { id: { in: [...cleanupIds.sales] } } });
  for (const productId of cleanupIds.products) {
    const variants = await prisma.productVariant.findMany({ where: { productId }, select: { id: true } });
    await prisma.recipe.deleteMany({ where: { variantId: { in: variants.map((v) => v.id) } } });
    await prisma.productVariant.deleteMany({ where: { productId } });
  }
  await prisma.product.deleteMany({ where: { id: { in: [...cleanupIds.products] } } });
  await prisma.stockMovement.deleteMany({ where: { ingredientId: { in: [...cleanupIds.ingredients] } } });
  await prisma.stock.deleteMany({ where: { ingredientId: { in: [...cleanupIds.ingredients] } } });
  await prisma.ingredient.deleteMany({ where: { id: { in: [...cleanupIds.ingredients] } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  // Safety net in case scenario10 threw before reaching its own inline table cleanup.
  await prisma.table.deleteMany({ where: { locationId: DEFAULT_LOCATION_ID, number: 9001 } });
}

async function main() {
  await setup();
  const results: boolean[] = [];
  try {
    results.push(await scenario1_historicalProfitStableAcrossCostChange());
    results.push(await scenario2_newSaleAfterChangeUsesNewCost());
    results.push(await scenario3_productWithNoCostData());
    results.push(await scenario4_partiallyFilledRecipeCost());
    results.push(await scenario5_removedItemExcludedFromProfit());
    results.push(await scenario6_cancelledSaleExcludedFromDashboard());
    results.push(await scenario7_addSaleItemGetsItsOwnFreshSnapshot());
    results.push(await scenario8_fractionalQuantityWeightType());
    results.push(await scenario9_retryDoesNotCreateSecondSnapshot());
    results.push(await scenario10_pendingOrderSnapshotsAtAcceptTime());
    results.push(await scenario11_updateSaleItemPreservesUnitCostOnQuantityChange());
  } finally {
    await cleanup();
  }
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} scenarios PASS`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("Historical profit audit failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
