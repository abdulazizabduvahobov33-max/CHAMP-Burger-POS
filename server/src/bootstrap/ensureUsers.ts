import { Role } from "@prisma/client";
import bcrypt from "bcrypt";

import { prisma } from "../config/db.js";
import { DEFAULT_LOCATION_ID, DEFAULT_LOCATION_NAME } from "./menu.js";

/**
 * Self-healing first-run bootstrap for the default accounts. Exists because some hosts
 * (Render's free plan, notably) don't give you a shell to run `npm run seed` manually —
 * without this, a fresh deploy would have no way to log in at all.
 *
 * Safe by construction:
 *   - Looked up by the unique `login` column first; if a user with that login already exists,
 *     this returns immediately and touches nothing — an account whose password has since been
 *     changed is never reset, and this never runs twice.
 *   - Runs once at process startup, not per-request.
 *   - A failure here (e.g. the DB isn't reachable yet) is logged and swallowed rather than
 *     crashing the process — every other route already depends on the DB and will surface the
 *     same problem on its own the moment it's called.
 *   - The password is never written to logs, whether it came from an env var or the fallback
 *     default.
 */
async function ensureUserExists(options: { login: string; password: string; name: string; role: Role }): Promise<void> {
  const { login, password, name, role } = options;
  const existing = await prisma.user.findUnique({ where: { login } });
  if (existing) return;

  const location = await prisma.location.upsert({
    where: { id: DEFAULT_LOCATION_ID },
    update: {},
    create: { id: DEFAULT_LOCATION_ID, name: DEFAULT_LOCATION_NAME, isActive: true },
  });

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { name, login, passwordHash, role, isActive: true, locationId: location.id },
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Bootstrap: no "${role}" account existed — created "${login}". Change the password after logging in.`);
}

export async function ensureAdminExists(): Promise<void> {
  try {
    await ensureUserExists({
      login: process.env.SEED_ADMIN_LOGIN || "admin",
      password: process.env.SEED_ADMIN_PASSWORD || "admin123",
      name: process.env.SEED_ADMIN_NAME || "Super Admin",
      role: Role.SUPER_ADMIN,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("⚠️  Bootstrap: could not verify/create the initial admin account:", err);
  }
}

export async function ensureSellerExists(): Promise<void> {
  try {
    await ensureUserExists({
      login: process.env.SEED_SELLER_LOGIN || "seller",
      password: process.env.SEED_SELLER_PASSWORD || "seller123",
      name: process.env.SEED_SELLER_NAME || "Продавец",
      role: Role.SELLER,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("⚠️  Bootstrap: could not verify/create the initial seller account:", err);
  }
}
