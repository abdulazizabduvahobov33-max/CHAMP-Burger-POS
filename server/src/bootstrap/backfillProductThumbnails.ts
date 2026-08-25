import { prisma } from "../config/db.js";
import { generateThumbnail, thumbnailExists } from "../shared/utils/imageThumbnails.js";
import { UPLOADS_URL_PREFIX } from "../shared/utils/uploads.js";

/**
 * One-time-per-file, idempotent thumbnail backfill for every product photo uploaded before this
 * feature existed (new uploads already get one immediately — see upload.routes.ts). Runs on
 * every boot, same as the other bootstrap steps, but does real work only for a product whose
 * thumbnail doesn't exist yet:
 *   - Never touches a Product row — a thumbnail's filename is derived by convention from the
 *     original's own filename (see imageThumbnails.ts), so there's nothing to write back.
 *   - Never touches, moves, or deletes an original file.
 *   - A product whose thumbnail already exists is skipped via one fast fs.access() check.
 *   - One file failing (corrupt image, unsupported format, already-missing original, ...) is
 *     logged and skipped — it never stops the rest of the batch or the boot sequence.
 */
export async function backfillProductThumbnails(): Promise<void> {
  try {
    const products = await prisma.product.findMany({
      where: { imageUrl: { not: null } },
      select: { imageUrl: true },
    });

    let created = 0;
    let alreadyPresent = 0;
    let failed = 0;

    for (const product of products) {
      const imageUrl = product.imageUrl;
      if (!imageUrl || !imageUrl.startsWith(UPLOADS_URL_PREFIX)) continue;

      const filename = imageUrl.slice(UPLOADS_URL_PREFIX.length);
      if (!filename || filename.includes("/") || filename.includes("\\")) continue;

      try {
        if (await thumbnailExists(filename)) {
          alreadyPresent += 1;
          continue;
        }
        await generateThumbnail(filename);
        created += 1;
      } catch (err) {
        failed += 1;
        // eslint-disable-next-line no-console
        console.error(`⚠️  Thumbnail backfill: failed for "${filename}":`, err);
      }
    }

    if (created > 0 || failed > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `✅ Thumbnail backfill: created ${created} new thumbnail(s), ${alreadyPresent} already had one, ${failed} failed.`,
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("⚠️  Thumbnail backfill: could not run:", err);
  }
}
