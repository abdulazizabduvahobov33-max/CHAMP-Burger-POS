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

    // Rank in steps of 10 (not 1) so a category/product can be manually re-inserted between two
    // existing ones later without renumbering everything else.
    const categoryIdByName = new Map<string, string>();
    let newCategories = 0;
    let backfilledCategoryOrder = 0;
    for (const [index, name] of Object.values(CATEGORY).entries()) {
      const sortOrder = (index + 1) * 10;
      let category = await prisma.category.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
      if (!category) {
        category = await prisma.category.create({ data: { name, sortOrder } });
        newCategories++;
      } else if (category.sortOrder === null) {
        // Same catch-up reasoning as the photo backfill below — a category created by an
        // earlier run (before sortOrder existed) otherwise sorts after every ranked one forever.
        category = await prisma.category.update({ where: { id: category.id }, data: { sortOrder } });
        backfilledCategoryOrder++;
      }
      categoryIdByName.set(name, category.id);
    }

    let newProducts = 0;
    let newVariants = 0;
    let backfilledPhotos = 0;
    let backfilledProductOrder = 0;
    for (const [index, item] of MENU.entries()) {
      const sortOrder = (index + 1) * 10;
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
        newProducts++;
      } else {
        const patch: { imageUrl?: string; sortOrder?: number } = {};
        // Covers a product that was created by an earlier run of this function BEFORE menu.ts
        // had photos assigned yet (exactly what happened when the KRUNCH menu first shipped
        // without them) — this function only ever creates new products, so without this catch-up
        // step an already-existing row would never pick up a photo added to menu.ts later.
        if (item.imageFile && !product.imageUrl) patch.imageUrl = `${UPLOADS_URL_PREFIX}${item.imageFile}`;
        if (product.sortOrder === null) patch.sortOrder = sortOrder;

        if (Object.keys(patch).length > 0) {
          product = await prisma.product.update({ where: { id: product.id }, data: patch });
          if (patch.imageUrl) backfilledPhotos++;
          if (patch.sortOrder !== undefined) backfilledProductOrder++;
        }
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

    if (newCategories > 0 || newProducts > 0 || backfilledPhotos > 0 || backfilledCategoryOrder > 0 || backfilledProductOrder > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `✅ Bootstrap: seeded menu at "${location.name}" — ${newCategories} categories, ${newProducts} products, ` +
          `${newVariants} variants, ${backfilledPhotos} photos backfilled, ${backfilledCategoryOrder} category order + ` +
          `${backfilledProductOrder} product order backfilled.`,
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("⚠️  Bootstrap: could not verify/seed the menu:", err);
  }
}
