import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

/** Anything at or above this is worth knowing about in production. Currently expected to fire
 * on nearly every query while the Oregon(backend)↔Frankfurt(Neon) region-latency issue is
 * unresolved (measured ~500-1000ms per round trip externally) — that's the diagnostic signal
 * this exists to surface, not a bug in this threshold. Revisit once/if that's resolved. */
const SLOW_QUERY_MS = 200;

function createPrismaClient() {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "stdout", level: "warn" },
      { emit: "stdout", level: "error" },
    ],
  });

  // Dev keeps its previous behavior (every query logged, now with a duration too — strictly
  // more useful than before). Production only ever logs a query when it's this slow, so this
  // doesn't flood the log stream on every single request. Never logs `e.params` — only
  // `e.query` (the parameterized SQL shape, already visible in this repo's own
  // prisma/schema.prisma) — bound values can carry password hashes, tokens, or other data that
  // must never end up in a log.
  client.$on("query", (e) => {
    if (env.isProd) {
      if (e.duration >= SLOW_QUERY_MS) {
        // eslint-disable-next-line no-console
        console.warn(`⚠️  SLOW QUERY (${e.duration}ms): ${e.query}`);
      }
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`[prisma] (${e.duration}ms) ${e.query}`);
  });

  return client;
}

/**
 * Single shared Prisma instance.
 * In dev, hot-reload (tsx watch) can create many clients and exhaust
 * database connections — caching on globalThis prevents that.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!env.isProd) {
  globalForPrisma.prisma = prisma;
}
