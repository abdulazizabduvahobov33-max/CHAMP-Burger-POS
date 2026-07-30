import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";

import multer from "multer";

export const UPLOADS_DIR = path.resolve(process.cwd(), "src/uploads");
export const UPLOADS_URL_PREFIX = "/uploads/";

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const imageUpload = multer({
  storage: multer.diskStorage({
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

/** Best-effort cleanup — old/replaced product photos shouldn't accumulate on disk. */
export async function deleteUploadedFile(url: string | null | undefined) {
  if (!url || !url.startsWith(UPLOADS_URL_PREFIX)) return;
  const filename = url.slice(UPLOADS_URL_PREFIX.length);
  if (!filename || filename.includes("/") || filename.includes("\\")) return;
  try {
    await unlink(path.join(UPLOADS_DIR, filename));
  } catch {
    // File already gone or never existed — nothing to do.
  }
}
