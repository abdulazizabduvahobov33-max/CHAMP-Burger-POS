import { Role } from "@prisma/client";
import bcrypt from "bcrypt";

import { prisma } from "../config/db.js";

const DEFAULT_LOCATION_ID = "main-location";

/**
 * Self-healing first-run bootstrap: creates the initial SUPER_ADMIN account if (and only if)
 * none exists yet. Exists because some hosts (Render's free plan, notably) don't give you a
 * shell to run `npm run seed` manually — without this, a fresh deploy would have no way to
 * log in at all.
 *
 * Safe by construction:
 *   - Looked up by the unique `login` column first; if a user with that login already exists,
 *     this returns immediately and touches nothing — an admin who has since changed their
 *     password is never reset, and this never runs twice.
 *   - Runs once at process startup, not per-request.
 *   - A failure here (e.g. the DB isn't reachable yet) is logged and swallowed rather than
 *     crashing the process — every other route already depends on the DB and will surface the
 *     same problem on its own the moment it's called.
 *   - The password is never written to logs, whether it came from SEED_ADMIN_PASSWORD or the
 *     fallback default.
 */
export async function ensureAdminExists(): Promise<void> {
  try {
    const login = process.env.SEED_ADMIN_LOGIN || "admin";
    const existing = await prisma.user.findUnique({ where: { login } });
    if (existing) return;

    const location = await prisma.location.upsert({
      where: { id: DEFAULT_LOCATION_ID },
      update: {},
      create: { id: DEFAULT_LOCATION_ID, name: "Главный филиал", isActive: true },
    });

    const password = process.env.SEED_ADMIN_PASSWORD || "admin123";
    const name = process.env.SEED_ADMIN_NAME || "Super Admin";
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: { name, login, passwordHash, role: Role.SUPER_ADMIN, isActive: true, locationId: location.id },
    });

    // eslint-disable-next-line no-console
    console.log(`✅ Bootstrap: no admin account existed — created "${login}". Change the password after logging in.`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("⚠️  Bootstrap: could not verify/create the initial admin account:", err);
  }
}
