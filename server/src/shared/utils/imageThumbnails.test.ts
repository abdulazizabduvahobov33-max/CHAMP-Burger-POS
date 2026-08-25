import { describe, expect, it } from "vitest";

import { thumbnailFilenameFor } from "./imageThumbnails.js";

describe("thumbnailFilenameFor", () => {
  it("swaps a .jpg extension for .thumb.webp", () => {
    expect(thumbnailFilenameFor("a6c8f577-5e6e-429f-9047-8440a5b6d5bc.jpg")).toBe(
      "a6c8f577-5e6e-429f-9047-8440a5b6d5bc.thumb.webp",
    );
  });

  it("works for .png and .webp originals too", () => {
    expect(thumbnailFilenameFor("logo.png")).toBe("logo.thumb.webp");
    expect(thumbnailFilenameFor("already-webp.webp")).toBe("already-webp.thumb.webp");
  });

  it("matches client/src/shared/lib/uploads.ts's toThumbnailUrl() convention exactly", () => {
    // Both sides derive the same name from the same original independently — see that file's
    // matching test for why this tripwire matters (a drift here means every thumbnail 404s).
    const original = "9b4f345a-40cb-43b7-9cd1-d6d5bdb67956.jpg";
    expect(thumbnailFilenameFor(original)).toBe(original.replace(/\.[^./]+$/, ".thumb.webp"));
  });
});
