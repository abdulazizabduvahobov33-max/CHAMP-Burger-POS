import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";

import multer from "multer";

import { deleteFromSupabase, isSupabaseConfigured, isSupabaseUrl } from "./supabaseStorage.js";

export const UPLOADS_DIR = path.resolve(process.cwd(), "src/uploads");
export const UPLOADS_URL_PREFIX = "/uploads/";

export const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// The 18 original menu photos, committed to git (see .gitignore's `!server/src/uploads/<uuid>`
// exceptions) so they survive Render's ephemeral filesystem across deploys. deleteUploadedFile()
// must never unlink one of these — a replaced/removed product photo among them should just leave
// the git-restored file alone on disk, never delete it from the working tree.
const SEED_FILENAMES = new Set([
  "a9e92b01-a635-407e-817c-abe53e75a1af.jpg",
  "7fde67a2-412f-4a59-89dd-bdf7d55eba71.jpg",
  "d7d51613-1e9b-4b66-a6ae-3921d5ecfa96.jpg",
  "855e0d34-7de7-41f5-9cdf-449c3b2c1d28.jpg",
  "cb9a41d0-b9a0-4146-baeb-f0ddf33d9dac.jpg",
  "cb5b034c-4d58-448b-ba42-f8f6a6da923f.jpg",
  "7a62557f-31dd-4959-89b4-d1a141b59e58.jpg",
  "4f882963-c9fd-4270-8555-8104fec7e28e.jpg",
  "d32e3642-ee88-43e9-82bb-e083e2b7f697.jpg",
  "a6c8f577-5e6e-429f-9047-8440a5b6d5bc.jpg",
  "93338e3d-48a4-4e05-b8ab-265af50c2001.jpg",
  "3581ad3d-5171-4a03-b570-2e664803488a.jpg",
  "a1c508aa-5e12-4fa0-a252-741caec9316c.jpg",
  "599ea818-6128-4c10-a81d-d4f3758872dc.jpg",
  "a4eb5184-fa5f-4061-92d1-0e21a420249d.jpg",
  "f8e24ac8-ae99-432a-a18d-2c3be7f673ae.jpg",
  "25a725e6-2fe0-405f-9240-74f61905383f.jpg",
  "2fd839f4-3acd-41db-92e7-6fbc67dacbb0.jpg",
]);

// With Supabase Storage configured, uploads never touch the ephemeral local disk at all — the
// file stays in memory just long enough to stream to Supabase (see upload.routes.ts). Without it
// (local dev, or before credentials are set up), behavior is unchanged from before this file
// ever knew Supabase existed: written straight to UPLOADS_DIR with a random filename.
export const imageUpload = multer({
  storage: isSupabaseConfigured
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${ALLOWED_MIME_TO_EXT[file.mimetype]}`),
      }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
      cb(new Error("UNSUPPORTED_IMAGE_TYPE"));
      return;
    }
    cb(null, true);
  },
});

/** Best-effort cleanup — old/replaced product photos shouldn't accumulate on disk or in the
 * Supabase Storage bucket. Routes by URL shape, so callers (product.service.ts,
 * settings.service.ts) never need to know which storage backend produced a given imageUrl. */
export async function deleteUploadedFile(url: string | null | undefined) {
  if (!url) return;

  if (isSupabaseUrl(url)) {
    // Two objects per upload — the original and its thumbnail (see upload.routes.ts, which
    // writes both under the same basename convention client's toThumbnailUrl() already expects).
    // Best-effort either way: a thumbnail that was never generated just 404s on delete, same as
    // a local unlink() of a file that's already gone.
    await deleteFromSupabase(url);
    await deleteFromSupabase(url.replace(/\.[^./?#]+$/, ".thumb.webp"));
    return;
  }

  if (!url.startsWith(UPLOADS_URL_PREFIX)) return;
  const filename = url.slice(UPLOADS_URL_PREFIX.length);
  if (!filename || filename.includes("/") || filename.includes("\\")) return;
  if (SEED_FILENAMES.has(filename)) return;
  try {
    await unlink(path.join(UPLOADS_DIR, filename));
  } catch {
    // File already gone or never existed — nothing to do.
  }
}
