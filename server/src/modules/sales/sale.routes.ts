import { Router } from "express";
import rateLimit from "express-rate-limit";

import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import * as controller from "./sale.controller.js";

const router = Router();

// Scoped tighter than the app-wide limiter: this is a write/transaction-heavy path (every
// call touches Sale, SaleItem and stock rows) reachable by any authenticated SELLER, not
// just SUPER_ADMIN. 60/min is generous for a single register's manual checkout pace.
const createSaleLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: "TOO_MANY_REQUESTS", message: "Слишком много запросов. Попробуйте позже." },
  },
});

router.post("/", createSaleLimiter, asyncHandler(controller.create));

export default router;
