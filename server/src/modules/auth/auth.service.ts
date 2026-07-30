import { randomUUID } from "node:crypto";

import bcrypt from "bcrypt";
import type { User } from "@prisma/client";

import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/error.js";
import { parseDurationMs } from "../../shared/utils/duration.js";
import { hashToken } from "../../shared/utils/hash.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../shared/utils/jwt.js";

const REFRESH_TTL_MS = parseDurationMs(env.jwt.refreshExpires);
const INVALID_CREDENTIALS_MESSAGE = "Неверный логин или пароль";
const SESSION_EXPIRED_MESSAGE = "Сессия истекла, войдите снова";

export type PublicUser = {
  id: string;
  name: string;
  login: string;
  role: User["role"];
  locationId: string;
};

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

function toPublicUser(user: User): PublicUser {
  return { id: user.id, name: user.name, login: user.login, role: user.role, locationId: user.locationId };
}

async function issueTokens(user: User): Promise<SessionTokens> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, locationId: user.locationId });

  const jti = randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, jti });

  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  return { accessToken, refreshToken };
}

export async function login(loginValue: string, password: string) {
  const user = await prisma.user.findUnique({ where: { login: loginValue } });
  if (!user || !user.isActive) {
    throw new AppError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  }

  const tokens = await issueTokens(user);
  return { ...tokens, user: toPublicUser(user) };
}

/** Verifies + rotates a refresh token: the old one is revoked, a new pair is issued. */
export async function refresh(rawToken: string | undefined) {
  if (!rawToken) {
    throw new AppError(401, "UNAUTHORIZED", SESSION_EXPIRED_MESSAGE);
  }

  let claims;
  try {
    claims = verifyRefreshToken(rawToken);
  } catch {
    throw new AppError(401, "UNAUTHORIZED", SESSION_EXPIRED_MESSAGE);
  }

  const record = await prisma.refreshToken.findUnique({ where: { id: claims.jti } });
  if (!record || record.tokenHash !== hashToken(rawToken) || record.userId !== claims.sub) {
    throw new AppError(401, "UNAUTHORIZED", SESSION_EXPIRED_MESSAGE);
  }

  // Rotation: the presented refresh token is single-use. Revoke atomically on the same
  // validity conditions checked above — if two requests race with the same token, only one
  // `updateMany` can match+flip `revokedAt` (count 1); the loser sees count 0 and is rejected,
  // instead of both passing a separate read-then-write check (same pattern as stock deduction).
  const revoked = await prisma.refreshToken.updateMany({
    where: { id: record.id, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { revokedAt: new Date() },
  });
  if (revoked.count === 0) {
    throw new AppError(401, "UNAUTHORIZED", SESSION_EXPIRED_MESSAGE);
  }

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user || !user.isActive) {
    throw new AppError(401, "UNAUTHORIZED", "Пользователь недоступен");
  }

  const tokens = await issueTokens(user);
  return { ...tokens, user: toPublicUser(user) };
}

export async function logout(rawToken: string | undefined) {
  if (!rawToken) return;

  try {
    const claims = verifyRefreshToken(rawToken);
    await prisma.refreshToken.updateMany({
      where: { id: claims.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Already invalid/expired — nothing to revoke.
  }
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new AppError(404, "NOT_FOUND", "Пользователь не найден");
  }
  return toPublicUser(user);
}

/** Self-service password change (any authenticated role) — requires the current password,
 * unlike an admin's `POST /api/users/:id/password` reset. Revokes every refresh token already
 * issued to this user, the same way a password reset does: if the old password leaked, changing
 * it should also kick out any session an attacker already opened with it. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new AppError(404, "NOT_FOUND", "Пользователь не найден");
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Неверный текущий пароль");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}
