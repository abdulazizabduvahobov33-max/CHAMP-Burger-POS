/**
 * READ-ONLY production performance diagnostics — table/index sizes, row counts, and EXPLAIN
 * plans for a few critical SELECTs. Everything runs inside one transaction whose first
 * statement is `SET TRANSACTION READ ONLY` (same guarantee as reportsProdReadOnlyCheck.ts —
 * verified there that Postgres itself rejects a write in this mode, not just that this script
 * doesn't attempt one). Never prints PRODUCTION_DATABASE_URL or any credential.
 *
 * Run from server/:  npx tsx prisma/prodPerformanceDiagnostics.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const productionDatabaseUrl = process.env.PRODUCTION_DATABASE_URL;
if (!productionDatabaseUrl) {
  console.error("PRODUCTION_DATABASE_URL is not set — aborting. This script never falls back to DATABASE_URL.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: productionDatabaseUrl } } });
type Tx = Prisma.TransactionClient;

async function main() {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");

      console.log("=== Row counts ===");
      const tables = ["sales", "sale_items", "stock_movements", "users", "products", "product_variants", "ingredients", "purchases", "purchase_items", "refresh_tokens", "sale_change_logs"];
      for (const t of tables) {
        const [{ count }] = await tx.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*)::bigint AS count FROM "${t}"`);
        console.log(`  ${t}: ${count}`);
      }

      console.log("\n=== Table + index sizes ===");
      const sizes = await tx.$queryRawUnsafe<{ table: string; total_size: string; index_size: string }[]>(`
        SELECT relname AS table,
               pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
               pg_size_pretty(pg_indexes_size(relid)) AS index_size
        FROM pg_catalog.pg_statio_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 15
      `);
      for (const s of sizes) console.log(`  ${s.table}: total=${s.total_size} indexes=${s.index_size}`);

      console.log("\n=== Existing indexes on sales / sale_items / stock_movements ===");
      const idx = await tx.$queryRawUnsafe<{ tablename: string; indexname: string }[]>(`
        SELECT tablename, indexname FROM pg_indexes
        WHERE tablename IN ('sales','sale_items','stock_movements')
        ORDER BY tablename, indexname
      `);
      for (const i of idx) console.log(`  ${i.tablename}.${i.indexname}`);

      console.log("\n=== EXPLAIN: recent sales list (last 30 days, first location found) ===");
      const [loc] = await tx.$queryRawUnsafe<{ locationId: string }[]>(`SELECT "locationId" FROM sales GROUP BY "locationId" LIMIT 1`);
      if (loc) {
        const plan = await tx.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(`
          EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
          SELECT id, "createdAt", "totalAmount" FROM sales
          WHERE "locationId" = '${loc.locationId}' AND status = 'ACCEPTED'
            AND "createdAt" >= NOW() - INTERVAL '30 days'
          ORDER BY "createdAt" DESC LIMIT 20
        `);
        for (const p of plan) console.log(p["QUERY PLAN"]);
      } else {
        console.log("  (no sales found — nothing to plan)");
      }

      console.log("\n=== EXPLAIN: dashboard revenue aggregate (last 30 days) ===");
      if (loc) {
        const plan2 = await tx.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(`
          EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
          SELECT SUM("totalAmount"), COUNT(*) FROM sales
          WHERE "locationId" = '${loc.locationId}' AND status = 'ACCEPTED'
            AND "createdAt" >= NOW() - INTERVAL '30 days'
        `);
        for (const p of plan2) console.log(p["QUERY PLAN"]);
      }
    },
    { timeout: 60_000 },
  );
}

main()
  .catch((err) => {
    console.error("Production performance diagnostics failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
