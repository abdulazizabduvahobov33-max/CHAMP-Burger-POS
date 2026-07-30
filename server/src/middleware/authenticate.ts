import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "../shared/utils/jwt.js";
import { AppError } from "./error.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { sub: string; role: import("@prisma/client").Role; locationId: string };
    }
  }
}

/** Verifies the `Authorization: Bearer <accessToken>` header and attaches `req.user`. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "UNAUTHORIZED", "Требуется авторизация"));
  }

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    req.user = { sub: payload.sub, role: payload.role, locationId: payload.locationId };
    next();
  } catch {
    next(new AppError(401, "UNAUTHORIZED", "Недействительный или истёкший токен"));
  }
}
