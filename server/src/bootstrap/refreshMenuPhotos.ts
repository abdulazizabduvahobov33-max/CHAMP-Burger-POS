import { prisma } from "../config/db.js";
import { UPLOADS_URL_PREFIX } from "../shared/utils/uploads.js";

/**
 * A second, one-time photo swap for products that already had a photo (unlike
 * ensureMenuSeeded.ts's backfill branch, which only ever fills in a NULL imageUrl and therefore
 * never revisits a product that's already got one). Seven of the original 18 stock photos turned
 * out to have problems on closer review: three drink shots showed a real Coca-Cola/Fanta/Pepsi
 * label (a genuine third-party trademark, not just a similar-looking generic can), "Лаваш" was
 * actually a photo of small tortilla pinwheels, "Самса с бараниной" had a leftover design/badge
 * graphic baked into the shot, and the fruit-cocktail and bulk-ice-cream photos didn't read as
 * either dish at a glance. This replaces exactly those seven with new ones from menu.ts.
 *
 * Only overwrites a product whose imageUrl is STILL the exact old file being replaced — an admin
 * who already re-uploaded their own photo for one of these products keeps it, same "don't clobber
 * a customization" reasoning as rebrandCafeName.ts's cafe_name check.
 */
const MARKER_KEY = "menu_photos_refresh_2026_08_done";

const REPLACEMENTS: { productName: string; oldImageFile: string; newImageFile: string }[] = [
  { productName: "Лаваш", oldImageFile: "34c91837-6514-4899-a493-088a13fa0fc1.jpg", newImageFile: "855e0d34-7de7-41f5-9cdf-449c3b2c1d28.jpg" },
  { productName: "Самса с бараниной", oldImageFile: "30698c88-01c0-4584-89da-e6ef333eb7b4.jpg", newImageFile: "cb5b034c-4d58-448b-ba42-f8f6a6da923f.jpg" },
  { productName: "Cola", oldImageFile: "5615f450-6eff-4ba7-86e4-e75c44e0a286.jpg", newImageFile: "4f882963-c9fd-4270-8555-8104fec7e28e.jpg" },
  { productName: "Fanta", oldImageFile: "5523a63f-488b-4f23-8abc-63fb7e4e1b38.jpg", newImageFile: "d32e3642-ee88-43e9-82bb-e083e2b7f697.jpg" },
  { productName: "Pepsi", oldImageFile: "8da2e0d3-8579-4e66-b4cb-ff43aa786830.jpg", newImageFile: "a6c8f577-5e6e-429f-9047-8440a5b6d5bc.jpg" },
  { productName: "Фруктовый коктейль", oldImageFile: "ca0ff521-49da-4b37-abbc-a43941a1e152.jpg", newImageFile: "f8e24ac8-ae99-432a-a18d-2c3be7f673ae.jpg" },
  { productName: "Мороженое на вес", oldImageFile: "1c4e1bd5-02e9-43aa-b129-114f23817be8.jpg", newImageFile: "2fd839f4-3acd-41db-92e7-6fbc67dacbb0.jpg" },
];

export async function refreshMenuPhotos(): Promise<void> {
  try {
    if (await prisma.setting.findUnique({ where: { key: MARKER_KEY } })) return;

    let updated = 0;
    for (const { productName, oldImageFile, newImageFile } of REPLACEMENTS) {
      const oldUrl = `${UPLOADS_URL_PREFIX}${oldImageFile}`;
      const result = await prisma.product.updateMany({
        where: { name: productName, imageUrl: oldUrl },
        data: { imageUrl: `${UPLOADS_URL_PREFIX}${newImageFile}` },
      });
      updated += result.count;
    }

    await prisma.setting.create({ data: { key: MARKER_KEY, value: "true" } });

    if (updated > 0) {
      // eslint-disable-next-line no-console
      console.log(`✅ Bootstrap: refreshed ${updated} menu photo(s) (Cola/Fanta/Pepsi/Лаваш/Самса с бараниной/Фруктовый коктейль/Мороженое на вес).`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("⚠️  Bootstrap: could not run the menu photo refresh:", err);
  }
}
