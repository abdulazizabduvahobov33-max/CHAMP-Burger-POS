/**
 * Read-only diagnostic — same check as checkMissingProductImages.ts, but runnable from ANY
 * machine with network access, needing neither Render Shell nor a plan change nor a restart of
 * the production service. Instead of checking the filesystem directly, it checks each photo's
 * PUBLIC url the exact same way a customer's browser already does every time the menu loads —
 * a plain HTTP HEAD request to the already-public /uploads/<file> route. That route is served
 * with zero auth (see server/src/app.ts's static /uploads middleware), so this adds no more load
 * or risk than one person browsing the menu once.
 *
 * Guarantees — same as checkMissingProductImages.ts:
 *   - One SELECT (Product.findMany), nothing else touches the database.
 *   - Every filesystem check on the production side is a HEAD request the server already
 *     handles for any visitor — no new code runs on the server, nothing is deployed, restarted,
 *     downloaded, or written anywhere.
 *   - Never prints DATABASE_URL, PRODUCTION_BASE_URL, or any other secret/env value — only
 *     product id/name/imageUrl/exists, the same data already visible in the admin UI.
 *   - Safe to run repeatedly.
 *
 * Needs two things in server/.env (never hardcoded, never logged, and deliberately NOT named
 * DATABASE_URL — sharing that name with the one local `npm run dev` already reads would risk
 * your local server silently pointing at production the next time it starts):
 *
 *   PRODUCTION_DATABASE_URL="<Render → champ-pos-db → External Database URL>"
 *   PRODUCTION_BASE_URL="https://champ-pos-backend.onrender.com"
 *
 * Run from the `server/` directory (needs @prisma/client, already installed there):
 *   npx tsx prisma/checkMissingProductImagesRemote.ts
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const UPLOADS_URL_PREFIX = "/uploads/";

const baseUrl = process.env.PRODUCTION_BASE_URL;
const productionDatabaseUrl = process.env.PRODUCTION_DATABASE_URL;
if (!baseUrl) {
  console.error("Set PRODUCTION_BASE_URL in server/.env first (the backend's public https://... URL, no trailing slash).");
  process.exit(1);
}
if (!productionDatabaseUrl) {
  console.error("Set PRODUCTION_DATABASE_URL in server/.env first (production's EXTERNAL Postgres connection string).");
  process.exit(1);
}

// Explicit datasource override, not the schema's default env("DATABASE_URL") binding — this
// process never reads process.env.DATABASE_URL at all, so there's no path by which it could
// mix up the local dev database with production.
const prisma = new PrismaClient({ datasources: { db: { url: productionDatabaseUrl } } });

type CheckResult = { exists: boolean; status: number | "network-error" };

async function fileExistsRemotely(imageUrl: string): Promise<CheckResult> {
  if (!imageUrl.startsWith(UPLOADS_URL_PREFIX)) return { exists: false, status: "network-error" };
  try {
    const res = await fetch(`${baseUrl}${imageUrl}`, { method: "HEAD" });
    return { exists: res.ok, status: res.status };
  } catch {
    // Network hiccup, not necessarily "file missing" — reported as not-exists either way since
    // this script only ever answers "confirmed present" vs "not confirmed present", never guesses.
    return { exists: false, status: "network-error" };
  }
}

async function main() {
  console.log(`Checking against: ${baseUrl}${UPLOADS_URL_PREFIX}...\n`);

  const products = await prisma.product.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, name: true, imageUrl: true },
    orderBy: { name: "asc" },
  });

  let existsCount = 0;
  const missing: (typeof products[number] & { status: CheckResult["status"] })[] = [];

  console.log("id                          | exists | status | name                            | imageUrl");
  console.log("-".repeat(110));

  for (const product of products) {
    const imageUrl = product.imageUrl as string;
    const { exists, status } = await fileExistsRemotely(imageUrl);
    if (exists) existsCount += 1;
    else missing.push({ ...product, status });
    console.log(
      `${product.id.padEnd(28)} | ${(exists ? "true" : "false").padEnd(6)} | ${String(status).padEnd(6)} | ${product.name.slice(0, 30).padEnd(32)} | ${imageUrl}`,
    );
  }

  console.log("\n--- SUMMARY ---");
  console.log(`Products with imageUrl set: ${products.length}`);
  console.log(`Files that exist (HTTP 200): ${existsCount}`);
  console.log(`Files MISSING:                ${missing.length}`);

  if (missing.length > 0) {
    console.log("\nProducts with a missing file (id, name, imageUrl, HTTP status):");
    for (const p of missing) console.log(`  - [${p.id}] ${p.name} -> ${p.imageUrl}  (status: ${p.status})`);
  }
}

main()
  .catch((err) => {
    console.error("Diagnostic failed:", err.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
