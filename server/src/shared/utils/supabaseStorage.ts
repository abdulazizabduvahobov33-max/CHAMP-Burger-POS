/**
 * Optional external image storage — used instead of the local `/uploads` disk when configured,
 * so newly-uploaded product/logo photos survive Render's free-plan ephemeral filesystem (see
 * server/prisma/checkMissingProductImagesRemote.ts, which is what first proved local uploads
 * don't survive a redeploy). Talks to Supabase Storage's plain REST API directly via `fetch` —
 * no SDK needed, since the only operations here (upload, delete, derive a public URL) are a
 * handful of authenticated HTTP calls, and pulling in `@supabase/supabase-js` would drag in its
 * auth/realtime/postgrest clients for zero benefit.
 *
 * Deliberately opt-in via env vars, not a hard dependency: with any of the three unset, every
 * caller (uploads.ts, upload.routes.ts) falls back to the original local-disk behavior
 * unchanged — this is what keeps local dev working without a Supabase project.
 */
const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_BUCKET_NAME;

export const isSupabaseConfigured = Boolean(projectUrl && serviceRoleKey && bucketName);

const PUBLIC_URL_PREFIX = isSupabaseConfigured ? `${projectUrl}/storage/v1/object/public/${bucketName}/` : null;

/** True for any URL this module produced — used by deleteUploadedFile() to route a delete to
 * the Supabase API instead of the local filesystem. */
export function isSupabaseUrl(url: string): boolean {
  return Boolean(PUBLIC_URL_PREFIX) && url.startsWith(PUBLIC_URL_PREFIX!);
}

function keyFromUrl(url: string): string | null {
  if (!PUBLIC_URL_PREFIX || !url.startsWith(PUBLIC_URL_PREFIX)) return null;
  return url.slice(PUBLIC_URL_PREFIX.length);
}

/** Uploads an in-memory image buffer under `key` (a bare filename, e.g. "<uuid>.jpg" — the
 * bucket is already dedicated to this app, so no extra folder prefix is needed) and returns its
 * permanent, publicly-readable HTTPS URL. Requires the bucket to be set Public in Supabase (see
 * setup instructions) — this module never generates signed URLs. */
export async function uploadBufferToSupabase(key: string, buffer: Buffer, contentType: string): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("Supabase Storage is not configured");
  const res = await fetch(`${projectUrl}/storage/v1/object/${bucketName}/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey!,
      "Content-Type": contentType,
    },
    body: buffer,
  });
  if (!res.ok) {
    throw new Error(`Supabase Storage upload failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return `${PUBLIC_URL_PREFIX}${key}`;
}

/** Best-effort delete — same "never fatal" contract as the local deleteUploadedFile(), since
 * callers already treat this as fire-and-forget cleanup, not something a request should fail on. */
export async function deleteFromSupabase(url: string): Promise<void> {
  const key = keyFromUrl(url);
  if (!key || !isSupabaseConfigured) return;
  try {
    await fetch(`${projectUrl}/storage/v1/object/${bucketName}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [key] }),
    });
  } catch {
    // Already gone, or a transient API error — nothing else to do; matches deleteUploadedFile's
    // local-disk unlink, which swallows ENOENT the same way.
  }
}
