import { beforeEach, describe, expect, it, vi } from "vitest";

const { unlinkMock, deleteFromSupabaseMock } = vi.hoisted(() => ({
  unlinkMock: vi.fn().mockResolvedValue(undefined),
  deleteFromSupabaseMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:fs/promises", () => ({ unlink: unlinkMock }));
vi.mock("./supabaseStorage.js", () => ({
  isSupabaseConfigured: false,
  isSupabaseUrl: (url: string) => url.startsWith("https://test.supabase.co/storage/v1/object/public/champ-pos-uploads/"),
  deleteFromSupabase: deleteFromSupabaseMock,
}));

import { deleteUploadedFile } from "./uploads.js";

describe("deleteUploadedFile", () => {
  beforeEach(() => {
    unlinkMock.mockClear();
    deleteFromSupabaseMock.mockClear();
  });

  it("never unlinks a git-tracked seed photo", async () => {
    await deleteUploadedFile("/uploads/a9e92b01-a635-407e-817c-abe53e75a1af.jpg");
    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it("still unlinks a non-seed local upload", async () => {
    await deleteUploadedFile("/uploads/9b4f345a-40cb-43b7-9cd1-d6d5bdb67956.jpg");
    expect(unlinkMock).toHaveBeenCalledTimes(1);
  });

  it("routes a Supabase Storage URL to its own delete API instead of the local filesystem, for both the original and its thumbnail", async () => {
    await deleteUploadedFile("https://test.supabase.co/storage/v1/object/public/champ-pos-uploads/abc123.jpg");
    expect(deleteFromSupabaseMock).toHaveBeenCalledTimes(2);
    expect(deleteFromSupabaseMock).toHaveBeenCalledWith(
      "https://test.supabase.co/storage/v1/object/public/champ-pos-uploads/abc123.jpg",
    );
    expect(deleteFromSupabaseMock).toHaveBeenCalledWith(
      "https://test.supabase.co/storage/v1/object/public/champ-pos-uploads/abc123.thumb.webp",
    );
    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it("does nothing for a null/undefined url", async () => {
    await deleteUploadedFile(null);
    await deleteUploadedFile(undefined);
    expect(unlinkMock).not.toHaveBeenCalled();
    expect(deleteFromSupabaseMock).not.toHaveBeenCalled();
  });
});
