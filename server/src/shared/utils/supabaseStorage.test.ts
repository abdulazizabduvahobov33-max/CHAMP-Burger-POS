import { describe, expect, it } from "vitest";

import { isSupabaseUrl } from "./supabaseStorage.js";

describe("isSupabaseUrl", () => {
  it("returns false when Supabase env vars aren't configured (test env has none set)", () => {
    // isSupabaseConfigured (and therefore the public-URL-prefix check) is false without all
    // three env vars — this locks in that a URL never gets misidentified as ours when Supabase
    // Storage isn't set up.
    expect(isSupabaseUrl("https://xyzcompany.supabase.co/storage/v1/object/public/champ-pos-uploads/abc.jpg")).toBe(
      false,
    );
  });

  it("rejects a local /uploads path and an unrelated absolute URL", () => {
    expect(isSupabaseUrl("/uploads/a9e92b01-a635-407e-817c-abe53e75a1af.jpg")).toBe(false);
    expect(isSupabaseUrl("https://example.com/photo.jpg")).toBe(false);
  });
});
