import bcrypt from "bcrypt";

import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { DEFAULT_LOCATION_ID, DEFAULT_LOCATION_NAME } from "./menu.js";

/**
 * Self-healing first-run bootstrap for the OWNER account — same shape as
 * ensureUsers.ts's ensureAdminExists/ensureSellerExists, with one deliberate difference: there
 * is NO fallback login/password. OWNER_LOGIN and OWNER_PASSWORD must both be set in the server's
 * own environment (Render dashboard, .env on a self-hosted box, ...) — never in application code
 * or the database an admin can browse. That's the entire point of this role: a SUPER_ADMIN
 * account (or anyone who can read this repo) has no way to know or guess it.
 *
 * Safe by construction, same as the other ensure*Exists bootstraps:
 *   - Looked up by the unique `login` first; if that user already exists, this returns
 *     immediately and never touches its password — so rotating OWNER_PASSWORD in the
 *     environment later does NOT retroactively change a password the owner may have since
 *     updated via the normal self-service change-password flow.
 *   - Missing/blank env vars mean "no owner account yet", not a crash — a fresh deploy without
 *     them configured simply has the /owner login not work until the operator sets them.
 */
export async function ensureOwnerExists(): Promise<void> {
  const login = env.owner.login?.trim();
  const password = env.owner.password;

  if (!login || !password) {
    // eslint-disable-next-line no-console
    console.log(
      "ℹ️  Bootstrap: OWNER_LOGIN/OWNER_PASSWORD not set — the owner panel has no account yet. " +
        "Set both in the server's environment to create one.",
    );
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { login } });
    if (existing) return;

    const location = await prisma.location.upsert({
      where: { id: DEFAULT_LOCATION_ID },
      update: {},
      create: { id: DEFAULT_LOCATION_ID, name: DEFAULT_LOCATION_NAME, isActive: true },
    });

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: { name: "Владелец", login, passwordHash, role: "OWNER", isActive: true, locationId: location.id },
    });

    // eslint-disable-next-line no-console
    console.log(`✅ Bootstrap: created the owner account "${login}".`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("⚠️  Bootstrap: could not verify/create the owner account:", err);
  }
}
