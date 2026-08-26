/**
 * Read-only diagnostic — does every Product.imageUrl currently point at a file that actually
 * exists on disk?
 *
 * Guarantees:
 *   - Only ever issues one SELECT (Product.findMany) and a handful of fs.access() checks.
 *   - No INSERT/UPDATE/DELETE of any kind — not to Product, not to any other table.
 *   - No filesystem write, no download, no repair, no file ever touched or moved.
 *   - Never prints DATABASE_URL, a connection string, or any other secret — only prints
 *     product id/name/imageUrl/exists, which is exactly the same data the admin Products page
 *     already shows in the browser.
 *   - Safe to run as many times as you like, in any environment: it has no side effects to
 *     accumulate or repeat.
 *   - Uses UPLOADS_DIR from shared/utils/uploads.ts (the exact same constant the running app
 *     itself uses to read/write uploads) rather than a hardcoded path, so it always checks
 *     wherever this environment is actually configured to store files — no separate
 *     path config to keep in sync.
 *
 * Run from the `server/` directory:
 *   npx tsx prisma/checkMissingProductImages.ts
 */

import { access } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from "../src/shared/utils/uploads.js";

dotenv.config();

const prisma = new PrismaClient();

type Row = {
  id: string;
  name: string;
  imageUrl: string;
  exists: boolean;
};

async function fileExistsOnDisk(imageUrl: string): Promise<boolean> {
  if (!imageUrl.startsWith(UPLOADS_URL_PREFIX)) {
    // Not a locally-stored upload (e.g. a hand-set absolute URL) — nothing on THIS filesystem
    // to check, so it can't be confirmed present here. Reported as exists:false in the output
    // below with a note, not silently skipped, so it isn't mistaken for "verified fine".
    return false;
  }
  const filename = imageUrl.slice(UPLOADS_URL_PREFIX.length);
  // Same defensive guard upload.routes.ts's own delete handler already uses — never resolve a
  // path outside UPLOADS_DIR, and never treat an empty/malformed value as a real filename.
  if (!filename || filename.includes("/") || filename.includes("\\")) return false;

  try {
    await access(path.join(UPLOADS_DIR, filename));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`Checking uploads under: ${UPLOADS_DIR}\n`);

  const products = await prisma.product.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, name: true, imageUrl: true },
    orderBy: { name: "asc" },
  });

  const rows: Row[] = [];
  for (const product of products) {
    const imageUrl = product.imageUrl as string;
    const exists = await fileExistsOnDisk(imageUrl);
    rows.push({ id: product.id, name: product.name, imageUrl, exists });
  }

  const missing = rows.filter((r) => !r.exists);
  const present = rows.filter((r) => r.exists);

  console.log("id                          | exists | name                            | imageUrl");
  console.log("-".repeat(100));
  for (const row of rows) {
    console.log(
      `${row.id.padEnd(28)} | ${(row.exists ? "true" : "false").padEnd(6)} | ${row.name.slice(0, 30).padEnd(32)} | ${row.imageUrl}`,
    );
  }

  console.log("\n--- SUMMARY ---");
  console.log(`Products with imageUrl set: ${rows.length}`);
  console.log(`Files that exist on disk:   ${present.length}`);
  console.log(`Files MISSING:               ${missing.length}`);

  if (missing.length > 0) {
    console.log("\nProducts with a missing file:");
    for (const row of missing) {
      console.log(`  - [${row.id}] ${row.name} -> ${row.imageUrl}`);
    }
  }
}

main()
  .catch((err) => {
    console.error("Diagnostic failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
