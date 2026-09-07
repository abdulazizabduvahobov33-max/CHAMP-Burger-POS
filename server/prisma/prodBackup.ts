/**
 * Creates a real pg_dump backup of production (Neon) — READ ONLY against the source (pg_dump
 * itself never writes to what it's dumping). Never prints PRODUCTION_DATABASE_URL or the
 * password: the URL is parsed in-process, non-secret parts (host/port/user/db/sslmode) are
 * passed as normal pg_dump flags, and the password is passed via the PGPASSWORD env var (never
 * appears on the process command line, unlike a flag would).
 *
 * Uses the matching major version (18) of pg_dump for production's actual server version
 * (confirmed via `SELECT version()` beforehand) — installed locally at the path below.
 *
 * Output is intentionally written OUTSIDE the git repo (the scratchpad dir passed as argv[2]) —
 * it contains real (if currently tiny) production data and must never be committed.
 *
 * Usage: npx tsx prisma/prodBackup.ts <output-directory>
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

dotenv.config();

const PG_DUMP = "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe";

function main() {
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!prodUrl) {
    console.error("PRODUCTION_DATABASE_URL is not set — aborting.");
    process.exit(1);
  }
  const outDir = process.argv[2];
  if (!outDir) {
    console.error("Usage: prodBackup.ts <output-directory>");
    process.exit(1);
  }
  if (!existsSync(PG_DUMP)) {
    console.error(`pg_dump not found at ${PG_DUMP} — install PostgreSQL 18 client tools or adjust the path.`);
    process.exit(1);
  }

  const url = new URL(prodUrl);
  const host = url.hostname;
  const port = url.port || "5432";
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const dbName = url.pathname.replace(/^\//, "");
  const sslmode = url.searchParams.get("sslmode") ?? "require"; // Neon requires TLS

  mkdirSync(outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(outDir, `sharof_kfs_prod_backup_${timestamp}.dump`);

  console.log(`Dumping production (host=${host.replace(/^[^.]+/, "***")}, db=${dbName}) to a local file...`);
  console.log("(host is partially masked above; full connection details are never printed)");

  execFileSync(
    PG_DUMP,
    [
      "-h", host,
      "-p", port,
      "-U", user,
      "-d", dbName,
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "-f", outFile,
    ],
    {
      env: { ...process.env, PGPASSWORD: password, PGSSLMODE: sslmode },
      stdio: "inherit",
    },
  );

  const size = statSync(outFile).size;
  console.log(`\nBackup complete: ${outFile}`);
  console.log(`Size: ${size} bytes (${(size / 1024).toFixed(1)} KB)`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
}

main();
