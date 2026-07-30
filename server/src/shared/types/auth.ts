import type { Role } from "@prisma/client";

/** Decoded access-token payload, attached to `req.user` by the `authenticate` middleware. */
export type AuthPayload = {
  sub: string;
  role: Role;
  locationId: string;
};

export type AccessTokenClaims = AuthPayload & { type: "access" };
export type RefreshTokenClaims = { sub: string; jti: string; type: "refresh" };
