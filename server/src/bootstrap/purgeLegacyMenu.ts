import { prisma } from "../config/db.js";
import { clearWorkingData } from "../modules/settings/settings.service.js";
import { deleteUploadedFile } from "../shared/utils/uploads.js";

// The full menu/category list from the PREVIOUS client (CHAMP Burger) — frozen here as plain
// literals, not imported from bootstrap/menu.ts, since that file now holds the NEW client's
// (KRUNCH) menu. This module exists purely to retire what used to be there.
const LEGACY_PRODUCT_NAMES = [
  "Гамбургер", "Чизбургер", "Chicken Burger", "Chicken Cheese",
  "Kanada", "Salat", "BBQ (Hot-dog)", "Mangal", "Lavash", "Qazili Hot-dog",
  "American Hot-dog", "Koralevskiy Hot-dog",
  "Hagi", "Doner", "Kartoshka po derevenski", "Kefsi", "Fri", "Kofe", "Limon choy",
];
const LEGACY_CATEGORY_NAMES = ["Бургеры", "Хот-доги и лаваш", "Прочее", "Напитки"];
const LEGACY_CAFE_NAMES = ["CHAMP Burger", "CHAMP Burger Test"];
const NEW_CAFE_NAME = "KRUNCH";

// Runs once — after the first successful purge this Setting row exists, so every later boot
// returns immediately. Safe to leave in the bootstrap chain permanently: it's a no-op on any
// install that never had the old menu (a brand-new deploy purges nothing and just sets the
// marker), and it can never fire twice on one that did.
const MARKER_KEY = "legacy_menu_purged";

export async function purgeLegacyMenu(): Promise<void> {
  try {
    if (await prisma.setting.findUnique({ where: { key: MARKER_KEY } })) return;

    const legacyProducts = await prisma.product.findMany({
      where: { name: { in: LEGACY_PRODUCT_NAMES } },
      select: { id: true },
    });

    if (legacyProducts.length > 0) {
      const productIds = legacyProducts.map((p) => p.id);

      // Every sale in a DB that only ever had the old menu is necessarily built entirely out of
      // old-menu items — there's no KRUNCH product for a sale to reference yet at this point in
      // bootstrap. clearWorkingData() (already used by Settings' "Очистить тестовые данные")
      // wipes SaleItem/Sale/PurchaseItem/Purchase/StockMovement/PriceHistory/Backup, which is
      // exactly what needs to be gone before a ProductVariant with sale history can be deleted —
      // reusing it here instead of re-deriving the same FK-safe deletion order.
      await clearWorkingData();

      // ProductVariant -> Recipe and ProductVariant -> PriceHistory both cascade in the schema,
      // so deleting the variants (then the products) is enough; SaleItem is already gone above.
      await prisma.productVariant.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });

      await prisma.category.deleteMany({
        where: { name: { in: LEGACY_CATEGORY_NAMES }, products: { none: {} } },
      });

      // eslint-disable-next-line no-console
      console.log(`✅ Bootstrap: purged ${productIds.length} legacy CHAMP products and their sale history.`);
    }

    const cafeName = await prisma.setting.findUnique({ where: { key: "cafe_name" } });
    if (cafeName && LEGACY_CAFE_NAMES.includes(cafeName.value)) {
      await prisma.setting.update({ where: { key: "cafe_name" }, data: { value: NEW_CAFE_NAME } });
    }

    // Both are the previous client's real data (their phone number; a 1x1 test-upload PNG left
    // over from an earlier verification pass) — anything in these two keys necessarily predates
    // KRUNCH, since this purge runs exactly once, on the first boot after the changeover.
    const contactPhone = await prisma.setting.findUnique({ where: { key: "contact_phone" } });
    if (contactPhone && contactPhone.value !== "") {
      await prisma.setting.update({ where: { key: "contact_phone" }, data: { value: "" } });
    }

    const logoUrl = await prisma.setting.findUnique({ where: { key: "logo_url" } });
    if (logoUrl && logoUrl.value !== "") {
      await deleteUploadedFile(logoUrl.value);
      await prisma.setting.update({ where: { key: "logo_url" }, data: { value: "" } });
    }

    await prisma.setting.create({ data: { key: MARKER_KEY, value: "true" } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("⚠️  Bootstrap: could not purge the legacy menu:", err);
  }
}
