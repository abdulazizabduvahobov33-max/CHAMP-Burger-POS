import { prisma } from "../config/db.js";
import { BASELINE_INGREDIENTS } from "./ingredients.js";
import { DEFAULT_LOCATION_ID, DEFAULT_LOCATION_NAME } from "./menu.js";

/**
 * Self-healing first-run bootstrap for the baseline ingredient set — same motivation and shape
 * as `ensureMenuSeeded`: Render's free plan (and any host with no shell) has no way to run
 * `npm run seed` by hand, so a fresh database would otherwise start with an empty warehouse.
 *
 * Idempotent by construction: each name is looked up case-insensitively among ACTIVE ingredients
 * (the same scope `ingredient.service.ts`'s `assertNameAvailable` uses for uniqueness) before
 * creating anything, so re-running this on every server start — or restoring a DB that already
 * has these rows — never creates a duplicate. A name an admin has since edited or deleted is
 * never recreated or overwritten; this only ever fills in what's missing.
 */
export async function ensureIngredientsSeeded(): Promise<void> {
  try {
    const location = await prisma.location.upsert({
      where: { id: DEFAULT_LOCATION_ID },
      update: {},
      create: { id: DEFAULT_LOCATION_ID, name: DEFAULT_LOCATION_NAME, isActive: true },
    });

    let created = 0;
    for (const item of BASELINE_INGREDIENTS) {
      const existing = await prisma.ingredient.findFirst({
        where: { isActive: true, name: { equals: item.name, mode: "insensitive" } },
      });
      if (existing) continue;

      // Same shape as ingredient.service.ts's createIngredient — Ingredient + a zeroed Stock
      // row for the default location, in one transaction — so a seeded row is indistinguishable
      // from one an admin created by hand.
      await prisma.$transaction(async (tx) => {
        const ingredient = await tx.ingredient.create({
          data: { name: item.name, unit: item.unit, minQuantity: item.minQuantity },
        });
        await tx.stock.create({ data: { ingredientId: ingredient.id, locationId: location.id, quantity: 0 } });
      });
      created++;
    }

    if (created > 0) {
      // eslint-disable-next-line no-console
      console.log(`✅ Bootstrap: seeded ${created} baseline ingredient(s) at "${location.name}".`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("⚠️  Bootstrap: could not verify/seed the baseline ingredients:", err);
  }
}
