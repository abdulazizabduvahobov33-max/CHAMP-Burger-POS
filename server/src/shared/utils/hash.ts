import { createHash } from "node:crypto";

/** SHA-256 hex digest — used to store refresh tokens without keeping the raw value in the DB. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
