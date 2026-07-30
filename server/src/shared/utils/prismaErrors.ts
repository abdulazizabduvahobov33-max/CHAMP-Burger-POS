import { Prisma } from "@prisma/client";

function isKnownRequestError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/** P2003 — the row is still referenced by another table (delete blocked by a real FK constraint). */
export function isForeignKeyViolation(error: unknown): boolean {
  return isKnownRequestError(error, "P2003");
}

/** P2002 — a unique constraint/index was violated (including case-insensitive functional indexes). */
export function isUniqueViolation(error: unknown): boolean {
  return isKnownRequestError(error, "P2002");
}
