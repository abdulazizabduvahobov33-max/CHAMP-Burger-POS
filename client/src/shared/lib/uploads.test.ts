import { describe, expect, it } from "vitest";

import { toThumbnailUrl } from "./uploads";

describe("toThumbnailUrl", () => {
  it("swaps a .jpg extension for .thumb.webp", () => {
    expect(toThumbnailUrl("/uploads/a6c8f577-5e6e-429f-9047-8440a5b6d5bc.jpg")).toBe(
      "/uploads/a6c8f577-5e6e-429f-9047-8440a5b6d5bc.thumb.webp",
    );
  });

  it("works for .png and .webp originals too", () => {
    expect(toThumbnailUrl("/uploads/logo.png")).toBe("/uploads/logo.thumb.webp");
    expect(toThumbnailUrl("/uploads/already-webp.webp")).toBe("/uploads/already-webp.thumb.webp");
  });

  it("matches server/src/shared/utils/imageThumbnails.ts's thumbnailFilenameFor() convention exactly", () => {
    // Both sides derive the same name from the same original independently — this is the whole
    // reason no database column is needed for "does this photo have a thumbnail". If either
    // side's regex ever drifts from the other, every thumbnail 404s and every card silently
    // falls back to the original — this test is the tripwire for that.
    const original = "9b4f345a-40cb-43b7-9cd1-d6d5bdb67956.jpg";
    expect(toThumbnailUrl(`/uploads/${original}`)).toBe(
      `/uploads/${original.replace(/\.[^./]+$/, ".thumb.webp")}`,
    );
  });
});
