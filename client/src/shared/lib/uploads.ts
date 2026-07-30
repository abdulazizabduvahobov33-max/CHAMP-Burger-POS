import { api } from "./api";

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
