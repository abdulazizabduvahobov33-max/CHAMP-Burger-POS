import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

/**
 * Single shared Prisma instance.
 * In dev, hot-reload (tsx watch) can create many clients and exhaust
 * database connections — caching on globalThis prevents that.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProd ? ["error"] : ["query", "warn", "error"],
  });

if (!env.isProd) {
  globalForPrisma.prisma = prisma;
}
