import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";

import { AppError } from "./error.js";

/** Must run after `authenticate`. Rejects the request if `req.user.role` isn't in `roles`. */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, "UNAUTHORIZED", "Требуется авторизация"));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "FORBIDDEN", "Недостаточно прав для этого действия"));
    }
    next();
  };
}
