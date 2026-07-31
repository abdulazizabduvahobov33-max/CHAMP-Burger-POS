import { SaleType } from "@prisma/client";

import { prisma } from "../config/db.js";
import { UPLOADS_URL_PREFIX } from "../shared/utils/uploads.js";
import { CATEGORY, DEFAULT_LOCATION_ID, DEFAULT_LOCATION_NAME, MENU } from "./menu.js";

/**
 * Self-healing first-run bootstrap for the menu itself — same motivation as
 * `ensureAdminExists`: Render's free plan (and any host with no shell) has no way to run
 * `npm run seed` by hand, so a fresh database would otherwise have an admin account but a
 * completely empty menu.
 *
 * Idempotent by construction, same pattern as `prisma/seed.ts` (which this shares its menu
 * data with — see `./menu.ts`): categories are looked up case-insensitively before creating,
 * products by exact name, variants by (productId, label) — nothing here is ever duplicated or
 * overwritten on a second run, so it's safe to call on every server start regardless of
 * environment (dev, Docker, VPS, Render).
 */
export async function ensureMenuSeeded(): Promise<void> {
  try {
    const location = await prisma.location.upsert({
      where: { id: DEFAULT_LOCATION_ID },
      update: {},
      create: { id: DEFAULT_LOCATION_ID, name: DEFAULT_LOCATION_NAME, isActive: true },
    });

    const categoryIdByName = new Map<string, string>();
    let newCategories = 0;
    for (const name of Object.values(CATEGORY)) {
      let category = await prisma.category.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
      if (!category) {
        category = await prisma.category.create({ data: { name } });
        newCategories++;
      }
      categoryIdByName.set(name, category.id);
    }

    let newProducts = 0;
    let newVariants = 0;
    for (const item of MENU) {
      let product = await prisma.product.findFirst({ where: { name: item.name } });

      if (!product) {
        product = await prisma.product.create({
          data: {
            name: item.name,
            categoryId: categoryIdByName.get(item.category)!,
            saleType: item.saleType ?? SaleType.UNIT,
            imageUrl: item.imageFile ? `${UPLOADS_URL_PREFIX}${item.imageFile}` : null,
            isActive: true,
          },
        });
        newProducts++;
      }

      for (const v of item.variants) {
        const existingVariant = await prisma.productVariant.findFirst({
          where: { productId: product.id, label: v.label },
        });
        if (!existingVariant) {
          await prisma.productVariant.create({ data: { productId: product.id, label: v.label, price: v.price } });
          newVariants++;
        }
      }
    }

    if (newCategories > 0 || newProducts > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `✅ Bootstrap: seeded menu at "${location.name}" — ${newCategories} categories, ${newProducts} products, ${newVariants} variants.`,
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("⚠️  Bootstrap: could not verify/seed the menu:", err);
  }
}
