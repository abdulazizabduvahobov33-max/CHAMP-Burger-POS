/**
 * Generates realistic-VOLUME synthetic data on TEST DB — 10k Sales / ~40-50k SaleItems / ~40k+
 * StockMovements spread over the last 365 days — so EXPLAIN ANALYZE against a near-empty table
 * isn't trivially always a Seq Scan (meaningless for judging index usefulness at production
 * scale). Runs ONLY against whatever DATABASE_URL is configured — never point this at
 * production; this generates data, it never reads/writes anything else.
 *
 * Fully isolated: all synthetic rows point at ONE dedicated Location/User pair
 * (GROWTH_SIM_LOCATION / growth_sim_seller) created just for this, so they never show up in any
 * real-location report and can be deleted in one shot by locationId. Real product
 * variants/ingredients are referenced (shared catalog reference data, never modified) but no
 * fake products are created.
 *
 * Run from server/:  npx tsx prisma/growthSimulation.ts
 * Clean up:          npx tsx prisma/growthSimulation.ts --cleanup
 */
import { randomUUID } from "node:crypto";

import { PrismaClient, Prisma } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const SIM_LOCATION_ID = "growth-sim-location";
const N_SALES = Number(process.env.GROWTH_SIM_N_SALES ?? 10_000);
const DAYS_SPAN = 365;
const BATCH_SIZE = 2000;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

async function cleanup() {
  console.log("Cleaning up growth-simulation data...");
  const sim = await prisma.location.findUnique({ where: { id: SIM_LOCATION_ID } });
  if (!sim) {
    console.log("Nothing to clean up.");
    return;
  }
  await prisma.stockMovement.deleteMany({ where: { locationId: SIM_LOCATION_ID } });
  await prisma.saleChangeLog.deleteMany({ where: { sale: { locationId: SIM_LOCATION_ID } } });
  await prisma.saleItem.deleteMany({ where: { sale: { locationId: SIM_LOCATION_ID } } });
  await prisma.sale.deleteMany({ where: { locationId: SIM_LOCATION_ID } });
  await prisma.user.deleteMany({ where: { locationId: SIM_LOCATION_ID } });
  await prisma.location.delete({ where: { id: SIM_LOCATION_ID } });
  console.log("Done.");
}

async function main() {
  if (process.argv[2] === "--cleanup") {
    await cleanup();
    return;
  }

  const location = await prisma.location.upsert({
    where: { id: SIM_LOCATION_ID },
    update: {},
    create: { id: SIM_LOCATION_ID, name: "GROWTH_SIM_LOCATION", isActive: true },
  });

  const seller = await prisma.user.upsert({
    where: { login: "growth_sim_seller" },
    update: {},
    create: {
      name: "GROWTH_SIM_SELLER",
      login: "growth_sim_seller",
      passwordHash: "not-a-real-hash-simulation-only",
      role: "SUPER_ADMIN",
      isActive: true,
      locationId: location.id,
    },
  });

  const variants = await prisma.productVariant.findMany({ select: { id: true, price: true }, where: { isActive: true } });
  if (variants.length === 0) throw new Error("No active product variants found — seed the menu first.");

  const recipesByVariant = new Map<string, { ingredientId: string; quantity: Prisma.Decimal }[]>();
  const recipes = await prisma.recipe.findMany({ select: { variantId: true, ingredientId: true, quantity: true } });
  for (const r of recipes) {
    const list = recipesByVariant.get(r.variantId) ?? [];
    list.push({ ingredientId: r.ingredientId, quantity: r.quantity });
    recipesByVariant.set(r.variantId, list);
  }

  // This TEST DB's catalog currently has zero real recipe rows (they only ever existed as
  // throwaway audit fixtures, cleaned up afterward) — with no recipe data to deduct against,
  // every sale would generate zero StockMovements, defeating the point of this generator (real
  // row VOLUME for index/EXPLAIN testing, not a financial-correctness fixture). Falls back to
  // one synthetic movement per item against a random real ingredient in that case, so
  // StockMovement still gets populated at a realistic volume; if real recipes DO exist, those
  // are used instead and this fallback never triggers.
  const allIngredientIds = recipes.length > 0 ? [] : (await prisma.ingredient.findMany({ select: { id: true } })).map((i) => i.id);
  if (recipes.length === 0 && allIngredientIds.length === 0) {
    throw new Error("No recipes AND no ingredients found — seed the warehouse catalog first.");
  }

  console.log(`Generating ${N_SALES} sales over the last ${DAYS_SPAN} days, using ${variants.length} real variants...`);

  const now = Date.now();
  let totalItems = 0;
  let totalMovements = 0;

  for (let batchStart = 0; batchStart < N_SALES; batchStart += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, N_SALES - batchStart);
    const salesBatch: Prisma.SaleCreateManyInput[] = [];
    const itemsBatch: Prisma.SaleItemCreateManyInput[] = [];
    const movementsBatch: Prisma.StockMovementCreateManyInput[] = [];

    for (let i = 0; i < batchSize; i++) {
      const saleId = randomUUID();
      const createdAt = new Date(now - randomInt(0, DAYS_SPAN * 24 * 60 * 60 * 1000));
      // 90% ACCEPTED (deducts stock, counts in reports), 6% CANCELLED, 4% PENDING — roughly
      // mirrors a real shop's mix without needing to be exact for query-plan purposes.
      const roll = Math.random();
      const status = roll < 0.9 ? "ACCEPTED" : roll < 0.96 ? "CANCELLED" : "PENDING";
      const itemCount = randomInt(1, 6);

      let total = new Prisma.Decimal(0);
      const saleItemIds: string[] = [];
      for (let j = 0; j < itemCount; j++) {
        const variant = pick(variants);
        const quantity = randomInt(1, 3);
        const unitPrice = variant.price;
        const subtotal = unitPrice.mul(quantity);
        total = total.add(subtotal);
        const itemId = randomUUID();
        saleItemIds.push(itemId);
        itemsBatch.push({
          id: itemId,
          saleId,
          variantId: variant.id,
          quantity,
          unitPrice,
          subtotal,
          hasCostSnapshot: false,
        });

        if (status === "ACCEPTED") {
          const recipeLines = recipesByVariant.get(variant.id) ?? [];
          if (recipeLines.length > 0) {
            for (const line of recipeLines) {
              movementsBatch.push({
                id: randomUUID(),
                ingredientId: line.ingredientId,
                locationId: location.id,
                change: line.quantity.mul(quantity).neg(),
                reason: "SALE",
                referenceId: itemId,
                createdById: seller.id,
                createdAt,
              });
            }
          } else {
            // Fallback volume-only movement — see the comment above allIngredientIds.
            movementsBatch.push({
              id: randomUUID(),
              ingredientId: pick(allIngredientIds),
              locationId: location.id,
              change: new Prisma.Decimal(-quantity),
              reason: "SALE",
              referenceId: itemId,
              createdById: seller.id,
              createdAt,
            });
          }
        }
      }

      salesBatch.push({
        id: saleId,
        sellerId: seller.id,
        locationId: location.id,
        totalAmount: total,
        status: status as Prisma.SaleCreateManyInput["status"],
        acceptedAt: status === "ACCEPTED" ? createdAt : null,
        createdAt,
        clientRequestId: randomUUID(),
      });
    }

    await prisma.sale.createMany({ data: salesBatch });
    await prisma.saleItem.createMany({ data: itemsBatch });
    if (movementsBatch.length > 0) await prisma.stockMovement.createMany({ data: movementsBatch });

    totalItems += itemsBatch.length;
    totalMovements += movementsBatch.length;
    console.log(`  ...${batchStart + batchSize}/${N_SALES} sales (${totalItems} items, ${totalMovements} movements so far)`);
  }

  console.log(`\nDone. ${N_SALES} sales, ${totalItems} sale items, ${totalMovements} stock movements, all under locationId="${SIM_LOCATION_ID}".`);
  console.log(`Run "npx tsx prisma/growthSimulation.ts --cleanup" to remove this data when finished.`);
}

main()
  .catch((err) => {
    console.error("Growth simulation failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
