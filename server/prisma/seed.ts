/**
 * Seed — Module 1
 *
 * Inserts the baseline data the system needs to start:
 *   • Main Location ("Главный филиал")
 *   • Super Admin user
 *   • Default settings (cafe name, currency, phone)
 *   • Categories are implicit (stored on Product.category)
 *   • All menu products with their price variants
 *
 * Recipes, ingredients and stock are added through their own modules
 * later — this seed only lays the foundation.
 *
 * Idempotent: safe to run multiple times (upserts by unique keys).
 */

import { PrismaClient, Role, SaleType } from "@prisma/client";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

import { BASELINE_INGREDIENTS } from "../src/bootstrap/ingredients.js";
import { MENU } from "../src/bootstrap/menu.js";
import { UPLOADS_URL_PREFIX } from "../src/shared/utils/uploads.js";

dotenv.config();

const prisma = new PrismaClient();

// Menu/categories/photo filenames now live in src/bootstrap/menu.ts — shared with the
// automatic first-run bootstrap (src/bootstrap/ensureMenuSeeded.ts) so hosts with no shell
// (Render's free plan) still get the full menu without this script ever running there.

async function main() {
  console.log("🌱 Seeding Sharof KFS database...\n");

  // ── 1. Main location ────────────────────────────────────────
  const location = await prisma.location.upsert({
    where: { id: "main-location" },
    update: {},
    create: {
      id: "main-location",
      name: "Главный филиал",
      isActive: true,
    },
  });
  console.log(`✅ Location: ${location.name}`);

  // ── 2. Super Admin ──────────────────────────────────────────
  const adminLogin = process.env.SEED_ADMIN_LOGIN ?? "admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Super Admin";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { login: adminLogin },
    update: {},
    create: {
      name: adminName,
      login: adminLogin,
      passwordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
      locationId: location.id,
    },
  });
  console.log(`✅ Super Admin: ${admin.login} (пароль из .env)`);

  // ── 2b. Demo Seller (for testing the Seller role / POS screen) ──
  const sellerLogin = process.env.SEED_SELLER_LOGIN ?? "seller";
  const sellerPassword = process.env.SEED_SELLER_PASSWORD ?? "seller123";
  const sellerName = process.env.SEED_SELLER_NAME ?? "Продавец";
  const sellerPasswordHash = await bcrypt.hash(sellerPassword, 10);

  const seller = await prisma.user.upsert({
    where: { login: sellerLogin },
    update: {},
    create: {
      name: sellerName,
      login: sellerLogin,
      passwordHash: sellerPasswordHash,
      role: Role.SELLER,
      isActive: true,
      locationId: location.id,
    },
  });
  console.log(`✅ Seller: ${seller.login} (пароль из .env)`);

  // ── 3. Default settings ─────────────────────────────────────
  const settings: { key: string; value: string }[] = [
    { key: "cafe_name", value: "Sharof KFS" },
    { key: "currency", value: "сум" },
    { key: "contact_phone", value: "" },
    { key: "logo_url", value: "" },
    { key: "low_stock_default_threshold", value: "10" },
    { key: "language", value: "ru" },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log(`✅ Settings: ${settings.length} keys`);

  // ── 4. Categories (Module 4 normalized these into their own table).
  // `name` isn't a Prisma-level @unique field (case-insensitive uniqueness is enforced by a
  // functional index instead — see schema.prisma), so this is findFirst+create, not upsert.
  // Rank in steps of 10, same reasoning as ensureMenuSeeded.ts — leaves room to manually
  // re-insert an item between two existing ones later without renumbering the rest.
  const categoryNames = [...new Set(MENU.map((item) => item.category))];
  const categoryIdByName = new Map<string, string>();
  let backfilledCategoryOrder = 0;
  for (const [index, name] of categoryNames.entries()) {
    const sortOrder = (index + 1) * 10;
    let category = await prisma.category.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (!category) {
      category = await prisma.category.create({ data: { name, sortOrder } });
    } else if (category.sortOrder === null) {
      category = await prisma.category.update({ where: { id: category.id }, data: { sortOrder } });
      backfilledCategoryOrder++;
    }
    categoryIdByName.set(name, category.id);
  }
  console.log(`✅ Categories: ${categoryNames.length} (${backfilledCategoryOrder} order backfilled)`);

  // ── 5. Menu products + variants ─────────────────────────────
  let productCount = 0;
  let variantCount = 0;
  let backfilledPhotos = 0;
  let backfilledProductOrder = 0;

  for (const [index, item] of MENU.entries()) {
    const sortOrder = (index + 1) * 10;
    // find existing by name to keep seed idempotent
    let product = await prisma.product.findFirst({ where: { name: item.name } });

    if (!product) {
      product = await prisma.product.create({
        data: {
          name: item.name,
          categoryId: categoryIdByName.get(item.category)!,
          saleType: item.saleType ?? SaleType.UNIT,
          imageUrl: item.imageFile ? `${UPLOADS_URL_PREFIX}${item.imageFile}` : null,
          isActive: true,
          sortOrder,
        },
      });
      productCount++;
    } else {
      // Same catch-up as ensureMenuSeeded.ts — a product created before menu.ts had photos or
      // sortOrder assigned yet otherwise never picks either up, since this loop only ever
      // creates new rows.
      const patch: { imageUrl?: string; sortOrder?: number } = {};
      if (item.imageFile && !product.imageUrl) patch.imageUrl = `${UPLOADS_URL_PREFIX}${item.imageFile}`;
      if (product.sortOrder === null) patch.sortOrder = sortOrder;

      if (Object.keys(patch).length > 0) {
        product = await prisma.product.update({ where: { id: product.id }, data: patch });
        if (patch.imageUrl) backfilledPhotos++;
        if (patch.sortOrder !== undefined) backfilledProductOrder++;
      }
    }

    for (const v of item.variants) {
      const existing = await prisma.productVariant.findFirst({
        where: { productId: product.id, label: v.label },
      });
      if (!existing) {
        await prisma.productVariant.create({
          data: { productId: product.id, label: v.label, price: v.price },
        });
        variantCount++;
      }
    }
  }
  console.log(
    `✅ Products: ${productCount} new, Variants: ${variantCount} new, Photos backfilled: ${backfilledPhotos}, ` +
      `Order backfilled: ${backfilledProductOrder}`,
  );

  // ── 6. Baseline ingredients ──────────────────────────────────
  // Same idempotent shape as products above (findFirst by case-insensitive name, then create) —
  // Ingredient has no @unique on name at the Prisma level either, see ingredient.service.ts.
  let ingredientCount = 0;
  for (const item of BASELINE_INGREDIENTS) {
    const existing = await prisma.ingredient.findFirst({
      where: { isActive: true, name: { equals: item.name, mode: "insensitive" } },
    });
    if (existing) continue;

    const ingredient = await prisma.ingredient.create({
      data: { name: item.name, unit: item.unit, minQuantity: item.minQuantity },
    });
    await prisma.stock.create({ data: { ingredientId: ingredient.id, locationId: location.id, quantity: 0 } });
    ingredientCount++;
  }
  console.log(`✅ Ingredients: ${ingredientCount} new`);

  console.log("\n🎉 Seed complete.");
  console.log("────────────────────────────────────");
  console.log(`   Admin login:    ${adminLogin}`);
  console.log(`   Admin password: ${adminPassword}`);
  console.log(`   Seller login:    ${sellerLogin}`);
  console.log(`   Seller password: ${sellerPassword}`);
  console.log(`   Menu items:     ${MENU.length}`);
  console.log("────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
