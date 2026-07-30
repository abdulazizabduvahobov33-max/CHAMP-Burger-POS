import { readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { deleteUploadedFile } from "../../shared/utils/uploads.js";
import type { UpdateSettingsInput } from "./settings.schema.js";

// Defaults for every key this module's UI edits — filled in even if a key was never written
// (a fresh DB only has whatever prisma/seed.ts inserted; Module 10 adds new keys on top of the
// six seed.ts already knows about, e.g. `address`/`timezone`, so older installs won't have rows
// for them yet).
const SETTINGS_DEFAULTS: Record<string, string> = {
  cafe_name: "",
  logo_url: "",
  contact_phone: "",
  address: "",
  currency: "",
  timezone: "",
  tax_percent: "0",
  receipt_header: "",
  receipt_footer: "",
};

export async function getCompanySettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.keys(SETTINGS_DEFAULTS) } } });
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...SETTINGS_DEFAULTS, ...values };
}

export async function updateCompanySettings(input: UpdateSettingsInput): Promise<Record<string, string>> {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined) as [string, string | number][];

  // Same cleanup Module 4's updateProduct does when a product's imageUrl changes — an old
  // logo replaced by a new upload shouldn't linger on disk forever.
  let previousLogoUrl: string | undefined;
  if (input.logo_url !== undefined) {
    previousLogoUrl = (await prisma.setting.findUnique({ where: { key: "logo_url" } }))?.value;
  }

  if (entries.length > 0) {
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          create: { key, value: String(value) },
          update: { value: String(value) },
        }),
      ),
    );
  }

  if (previousLogoUrl && previousLogoUrl !== input.logo_url) {
    void deleteUploadedFile(previousLogoUrl);
  }

  return getCompanySettings();
}

/**
 * Read-only — JWT lifetimes are `.env`-configured (Module 2), fixed for the process's
 * lifetime once loaded (server/src/config/env.ts). Per the module spec: don't duplicate that
 * configuration into the database, just surface the values already in effect.
 */
export function getSecurityInfo() {
  return {
    accessTokenExpiry: env.jwt.accessExpires,
    refreshTokenExpiry: env.jwt.refreshExpires,
  };
}

function readJsonVersion(relativePath: string): string {
  try {
    const raw = readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
    return (JSON.parse(raw) as { version?: string }).version ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * "Clear working data" — wipes transactional/operational history (sales, purchases, stock
 * movements, price history, backup records) and zeroes out live stock quantities + ingredient
 * cost rollups, so the app is ready for a real opening day without losing the catalog itself.
 *
 * Deliberately NOT touched: User, Setting, Location, Category, Product/ProductVariant (photos
 * live on Product.imageUrl), Recipe, Supplier, Ingredient (only its cost fields reset) — these
 * are the "structure" of the business, not a transaction log, and wiping them would mean
 * re-building the whole menu/warehouse from scratch.
 *
 * Deletion order mirrors prisma/reset-demo-data.ts (children before parents on the FK graph).
 */
export async function clearWorkingData() {
  return prisma.$transaction(async (tx) => {
    const saleItems = await tx.saleItem.deleteMany({});
    const sales = await tx.sale.deleteMany({});

    const purchaseItems = await tx.purchaseItem.deleteMany({});
    const purchases = await tx.purchase.deleteMany({});

    const stockMovements = await tx.stockMovement.deleteMany({});
    const priceHistory = await tx.priceHistory.deleteMany({});
    const backups = await tx.backup.deleteMany({});

    const stockReset = await tx.stock.updateMany({ data: { quantity: 0 } });
    const ingredientCostReset = await tx.ingredient.updateMany({ data: { lastUnitCost: 0, avgUnitCost: 0 } });

    return {
      saleItems: saleItems.count,
      sales: sales.count,
      purchaseItems: purchaseItems.count,
      purchases: purchases.count,
      stockMovements: stockMovements.count,
      priceHistory: priceHistory.count,
      backups: backups.count,
      stockRowsReset: stockReset.count,
      ingredientsCostReset: ingredientCostReset.count,
    };
  });
}

export async function getSystemInfo() {
  const [userCount, productCount, saleCount, purchaseCount, ingredientCount, pgVersion] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.sale.count(),
    prisma.purchase.count(),
    prisma.ingredient.count(),
    prisma.$queryRaw<{ version: string }[]>`SELECT version()`,
  ]);

  return {
    appVersion: readJsonVersion("package.json"),
    nodeVersion: process.version,
    prismaVersion: readJsonVersion("node_modules/@prisma/client/package.json"),
    postgresVersion: pgVersion[0]?.version ?? "unknown",
    counts: {
      users: userCount,
      products: productCount,
      sales: saleCount,
      purchases: purchaseCount,
      ingredients: ingredientCount,
    },
  };
}
