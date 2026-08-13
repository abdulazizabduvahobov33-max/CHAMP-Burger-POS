import bcrypt from "bcrypt";
import type { User } from "@prisma/client";

import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/error.js";
import { isForeignKeyViolation, isUniqueViolation } from "../../shared/utils/prismaErrors.js";
import type { CreateUserInput, SetPasswordInput, UpdateUserInput } from "./user.schema.js";

const SALT_ROUNDS = 10;
const DUPLICATE_LOGIN_MESSAGE = "Пользователь с таким логином уже существует";

// Arbitrary, fixed key for a Postgres advisory lock scoped to the "don't leave zero active
// SUPER_ADMINs" invariant (see updateUser/deleteUser) — not tied to any row, just a named
// mutex both functions take before checking+writing, so two concurrent requests that could
// each affect a DIFFERENT admin account still serialize against each other instead of each
// reading a pre-commit snapshot of the other.
const LAST_ADMIN_LOCK_KEY = 72190001;

function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    login: user.login,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

// OWNER rows never appear here — the Users page is a SUPER_ADMIN admin tool, and the owner
// account (bootstrap/ensureOwnerExists.ts) must stay invisible to it entirely, not just
// uneditable. See user.schema.ts for why creating/promoting-to OWNER is already blocked
// upstream; this is the read-side half of the same guarantee.
export async function listUsers() {
  const users = await prisma.user.findMany({ where: { role: { not: "OWNER" } }, orderBy: { name: "asc" } });
  return users.map(serializeUser);
}

async function findUserOrThrow(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  // Same 404-not-403 idiom as sale.service.ts's getMySale — a SUPER_ADMIN crafting a request
  // against a known/guessed OWNER user id learns nothing (not even that the id is valid),
  // rather than getting a clean "forbidden" that confirms the account exists.
  if (!user || user.role === "OWNER") {
    throw new AppError(404, "NOT_FOUND", "Пользователь не найден");
  }
  return user;
}

async function assertLoginAvailable(login: string, excludeId?: string) {
  const existing = await prisma.user.findFirst({
    where: { login: { equals: login, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) {
    throw new AppError(409, "DUPLICATE_LOGIN", DUPLICATE_LOGIN_MESSAGE);
  }
}

export async function createUser(locationId: string, input: CreateUserInput) {
  await assertLoginAvailable(input.login);
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: { name: input.name, login: input.login, passwordHash, role: input.role, locationId },
    });
    return serializeUser(user);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "DUPLICATE_LOGIN", DUPLICATE_LOGIN_MESSAGE);
    }
    throw error;
  }
}

export async function updateUser(id: string, actingUserId: string, input: UpdateUserInput) {
  const target = await findUserOrThrow(id);

  if (input.login) {
    await assertLoginAvailable(input.login, id);
  }

  const isSelf = id === actingUserId;
  const losingActiveStatus = input.isActive === false && target.isActive;
  const losingAdminRole = input.role !== undefined && input.role !== "SUPER_ADMIN" && target.role === "SUPER_ADMIN";

  if (isSelf && (losingActiveStatus || losingAdminRole)) {
    throw new AppError(409, "SELF_ACTION_FORBIDDEN", "Нельзя деактивировать себя или снять с себя роль администратора");
  }

  const touchesAdminInvariant = target.role === "SUPER_ADMIN" && target.isActive && (losingActiveStatus || losingAdminRole);

  try {
    const user = await prisma.$transaction(async (tx) => {
      if (touchesAdminInvariant) {
        // Serialized against any other concurrent request touching this same invariant —
        // see LAST_ADMIN_LOCK_KEY. Only the count-then-write itself needs to be inside the
        // lock; ordinary edits (name, login, non-admin role changes) never acquire it.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LAST_ADMIN_LOCK_KEY})`;
        const remaining = await tx.user.count({ where: { role: "SUPER_ADMIN", isActive: true, id: { not: id } } });
        if (remaining === 0) {
          throw new AppError(409, "LAST_ADMIN", "Нельзя оставить систему без единственного администратора");
        }
      }

      return tx.user.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.login !== undefined ? { login: input.login } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    });
    return serializeUser(user);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "DUPLICATE_LOGIN", DUPLICATE_LOGIN_MESSAGE);
    }
    throw error;
  }
}

export async function setUserPassword(id: string, input: SetPasswordInput) {
  await findUserOrThrow(id);
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  // A password reset by an admin should kick out any session issued under the old password,
  // same reasoning (and the same revocation mechanism) as a user changing their own password.
  await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function deleteUser(id: string, actingUserId: string) {
  const target = await findUserOrThrow(id);

  if (id === actingUserId) {
    throw new AppError(409, "SELF_ACTION_FORBIDDEN", "Нельзя удалить свою учётную запись");
  }

  const touchesAdminInvariant = target.role === "SUPER_ADMIN" && target.isActive;

  try {
    await prisma.$transaction(async (tx) => {
      if (touchesAdminInvariant) {
        // Same serialization as updateUser — see LAST_ADMIN_LOCK_KEY.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LAST_ADMIN_LOCK_KEY})`;
        const remaining = await tx.user.count({ where: { role: "SUPER_ADMIN", isActive: true, id: { not: id } } });
        if (remaining === 0) {
          throw new AppError(409, "LAST_ADMIN", "Нельзя удалить единственного администратора");
        }
      }

      await tx.user.delete({ where: { id } });
    });
  } catch (error) {
    // A user who has ever made a sale/purchase/stock movement/etc. can't be hard-deleted —
    // those tables have a required, non-cascading FK to User (schema.prisma). Deactivating
    // (isActive: false) preserves that history; only a never-active user can be truly removed.
    if (isForeignKeyViolation(error)) {
      throw new AppError(409, "USER_IN_USE", "Нельзя удалить: у пользователя есть история операций. Деактивируйте его вместо удаления");
    }
    throw error;
  }
}
