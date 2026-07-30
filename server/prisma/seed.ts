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

dotenv.config();

const prisma = new PrismaClient();

// ── Categories (stored as strings on products) ────────────────
const CATEGORY = {
  BURGERS: "Бургеры",
  HOTDOGS: "Хот-доги и лаваш",
  OTHER: "Прочее",
  DRINKS: "Напитки",
} as const;

// ── Menu, exactly as on the CHAMP Burger board ────────────────
// saleType UNIT = обычный; WEIGHT = по весу (Kefsi)
type MenuItem = {
  name: string;
  category: string;
  saleType?: SaleType;
  variants: { label: string; price: number }[];
};

const MENU: MenuItem[] = [
  // Бургеры
  { name: "Гамбургер", category: CATEGORY.BURGERS, variants: [
    { label: "25 000", price: 25000 }, { label: "35 000", price: 35000 } ] },
  { name: "Чизбургер", category: CATEGORY.BURGERS, variants: [
    { label: "28 000", price: 28000 }, { label: "38 000", price: 38000 } ] },
  { name: "Chicken Burger", category: CATEGORY.BURGERS, variants: [
    { label: "20 000", price: 20000 }, { label: "28 000", price: 28000 } ] },
  { name: "Chicken Cheese", category: CATEGORY.BURGERS, variants: [
    { label: "23 000", price: 23000 }, { label: "30 000", price: 30000 } ] },

  // Хот-доги и лаваш
  { name: "Kanada", category: CATEGORY.HOTDOGS, variants: [
    { label: "15 000", price: 15000 }, { label: "20 000", price: 20000 } ] },
  { name: "Salat", category: CATEGORY.HOTDOGS, variants: [
    { label: "15 000", price: 15000 }, { label: "20 000", price: 20000 }, { label: "25 000", price: 25000 } ] },
  { name: "BBQ (Hot-dog)", category: CATEGORY.HOTDOGS, variants: [
    { label: "25 000", price: 25000 }, { label: "35 000", price: 35000 } ] },
  { name: "Mangal", category: CATEGORY.HOTDOGS, variants: [
    { label: "25 000", price: 25000 }, { label: "35 000", price: 35000 } ] },
  { name: "Lavash", category: CATEGORY.HOTDOGS, variants: [
    { label: "35 000", price: 35000 }, { label: "38 000", price: 38000 } ] },
  { name: "Qazili Hot-dog", category: CATEGORY.HOTDOGS, variants: [
    { label: "25 000", price: 25000 }, { label: "30 000", price: 30000 }, { label: "35 000", price: 35000 } ] },
  { name: "American Hot-dog", category: CATEGORY.HOTDOGS, variants: [
    { label: "20 000", price: 20000 }, { label: "25 000", price: 25000 } ] },
  { name: "Koralevskiy Hot-dog", category: CATEGORY.HOTDOGS, variants: [
    { label: "25 000", price: 25000 } ] },

  // Прочее
  { name: "Hagi", category: CATEGORY.OTHER, variants: [
    { label: "35 000", price: 35000 } ] },
  { name: "Doner", category: CATEGORY.OTHER, variants: [
    { label: "30 000", price: 30000 }, { label: "40 000", price: 40000 } ] },
  { name: "Kartoshka po derevenski", category: CATEGORY.OTHER, variants: [
    { label: "18 000", price: 18000 } ] },
  { name: "Kefsi", category: CATEGORY.OTHER, saleType: SaleType.WEIGHT, variants: [
    { label: "100 000 / кг", price: 100000 } ] },
  { name: "Fri", category: CATEGORY.OTHER, variants: [
    { label: "15 000", price: 15000 } ] },
  { name: "Kofe", category: CATEGORY.DRINKS, variants: [
    { label: "10 000", price: 10000 } ] },
  { name: "Limon choy", category: CATEGORY.DRINKS, variants: [
    { label: "8 000", price: 8000 } ] },
];

async function main() {
  console.log("🌱 Seeding CHAMP Burger database...\n");

  // ── 1. Main location ────────────────────────────────────────
  const location = await prisma.location.upsert({
    where: { id: "main-location" },
    update: {},
    create: {
      id: "main-location",
      name: "Главный филиал",
      phone: "94 939 89 68",
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
    { key: "cafe_name", value: "CHAMP Burger" },
    { key: "currency", value: "сум" },
    { key: "contact_phone", value: "94 939 89 68" },
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
  const categoryNames = [...new Set(MENU.map((item) => item.category))];
  const categoryIdByName = new Map<string, string>();
  for (const name of categoryNames) {
    let category = await prisma.category.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (!category) {
      category = await prisma.category.create({ data: { name } });
    }
    categoryIdByName.set(name, category.id);
  }
  console.log(`✅ Categories: ${categoryNames.length}`);

  // ── 5. Menu products + variants ─────────────────────────────
  let productCount = 0;
  let variantCount = 0;

  for (const item of MENU) {
    // find existing by name to keep seed idempotent
    let product = await prisma.product.findFirst({ where: { name: item.name } });

    if (!product) {
      product = await prisma.product.create({
        data: {
          name: item.name,
          categoryId: categoryIdByName.get(item.category)!,
          saleType: item.saleType ?? SaleType.UNIT,
          isActive: true,
        },
      });
      productCount++;
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
  console.log(`✅ Products: ${productCount} new, Variants: ${variantCount} new`);

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
