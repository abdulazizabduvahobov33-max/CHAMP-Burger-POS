import { api } from "./api";

// The backend hands back uploaded-file URLs as a root-relative path ("/uploads/xxx.jpg"), which
// is deliberate — the DB shouldn't bake in a specific host. In dev that resolves correctly
// because Vite's dev server proxies /uploads to the backend (see vite.config.ts). But on a
// split-host deploy (a static frontend + a separate backend service — e.g. Render) there is no
// such proxy: the browser resolves a root-relative <img src> against the PAGE's own origin, i.e.
// the frontend's static host, which has no /uploads at all → 404 on every product photo. Deriving
// the backend's origin from VITE_API_URL (the same env var api.ts already requires for this
// exact split-host case) and prefixing relative upload paths with it fixes this without needing
// a second env var.
const UPLOADS_ORIGIN = (() => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return "";
  try {
    return new URL(apiUrl).origin;
  } catch {
    return "";
  }
})();

/** Turns a root-relative "/uploads/..." URL from the API into one that actually loads on a
 * split-host deploy. Absolute URLs and empty values pass through unchanged. */
export function resolveUploadUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${UPLOADS_ORIGIN}${url}`;
}

/** The optimized-thumbnail counterpart of an uploaded image's URL — same directory, same
 * basename, always `.thumb.webp` regardless of the original's own extension (see
 * server/src/shared/utils/imageThumbnails.ts, which generates it under that exact name). A pure
 * string transform, not a lookup: whether the file actually exists is discovered by the <img>'s
 * own onError fallback (see ProductImage.tsx), never checked here. Apply this to the RAW url
 * from the API before resolveUploadUrl(), not after — the origin prefix has to end up on the
 * outside either way, and composing it in that order is what the callers below already do. */
export function toThumbnailUrl(url: string): string {
  return url.replace(/\.[^./?#]+$/, ".thumb.webp");
}

/** Generic image upload — not tied to any one entity (`/uploads/image` just stores a file and
 * hands back its URL; Module 4 built it for product photos, Module 10 reuses it unchanged for
 * the company logo). */
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<{ url: string }>("/uploads/image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}

/** Best-effort — used to clean up an upload that never ended up attached to anything. */
export async function deleteImage(url: string): Promise<void> {
  try {
    await api.delete("/uploads/image", { data: { url } });
  } catch {
    // Not fatal — worst case an unused file lingers on disk.
  }
}
