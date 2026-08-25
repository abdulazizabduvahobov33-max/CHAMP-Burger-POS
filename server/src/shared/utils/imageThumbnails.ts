import { access } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { UPLOADS_DIR } from "./uploads.js";

/** Long-side cap in pixels — well above any product card this ships in today, comfortably under
 * what a multi-megabyte phone-camera original decodes to. */
export const THUMBNAIL_MAX_DIMENSION = 700;
export const THUMBNAIL_QUALITY = 80;

/**
 * Same directory, same basename as the original, always `.thumb.webp` regardless of the
 * original's own extension — a pure filename convention, not a stored reference, so nothing in
 * the database ever needs to know a thumbnail exists (see client's toThumbnailUrl(), which
 * derives the same name). That's also why this never collides with a real upload: multer only
 * ever writes `<uuid>.jpg|.png|.webp` (uploads.ts), never a `.thumb.webp` suffix.
 */
export function thumbnailFilenameFor(originalFilename: string): string {
  return originalFilename.replace(/\.[^./]+$/, ".thumb.webp");
}

export async function thumbnailExists(originalFilename: string): Promise<boolean> {
  try {
    await access(path.join(UPLOADS_DIR, thumbnailFilenameFor(originalFilename)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates (or regenerates) the thumbnail for one already-uploaded original — the original
 * file itself is only ever read, never modified or deleted. Resizes to fit within
 * THUMBNAIL_MAX_DIMENSION on the long side (never upscales a smaller original — `withoutEnlargement`),
 * preserving aspect ratio, and re-encodes as WebP at THUMBNAIL_QUALITY.
 *
 * Deliberately doesn't catch its own errors (a corrupt file, an unsupported format, a full disk)
 * — every caller (the upload route, the backfill bootstrap) treats a single failure as
 * best-effort and catches it locally, since a missing thumbnail is never fatal: ProductImage.tsx
 * falls back to the original URL on a 404.
 */
export async function generateThumbnail(originalFilename: string): Promise<void> {
  const originalPath = path.join(UPLOADS_DIR, originalFilename);
  const thumbnailPath = path.join(UPLOADS_DIR, thumbnailFilenameFor(originalFilename));
  await sharp(originalPath)
    .resize({
      width: THUMBNAIL_MAX_DIMENSION,
      height: THUMBNAIL_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toFile(thumbnailPath);
}
