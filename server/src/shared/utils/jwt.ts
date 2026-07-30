import jwt from "jsonwebtoken";

import { env } from "../../config/env.js";
import type { AccessTokenClaims, AuthPayload, RefreshTokenClaims } from "../types/auth.js";

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign({ ...payload, type: "access" } satisfies AccessTokenClaims, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, env.jwt.accessSecret) as AccessTokenClaims;
  if (payload.type !== "access") throw new Error("Not an access token");
  return payload;
}

export function signRefreshToken(payload: { sub: string; jti: string }): string {
  return jwt.sign({ ...payload, type: "refresh" } satisfies RefreshTokenClaims, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpires as jwt.SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  const payload = jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenClaims;
  if (payload.type !== "refresh") throw new Error("Not a refresh token");
  return payload;
}
