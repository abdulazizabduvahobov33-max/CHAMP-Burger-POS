import { Router } from "express";
import rateLimit from "express-rate-limit";

import { authorize } from "../../middleware/authorize.js";
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
router.get("/", asyncHandler(controller.list));
// Both literal paths — must come before the "/:id" param route below, or Express would try to
// match "pending" as an :id instead.
router.get("/pending", authorize("SUPER_ADMIN"), asyncHandler(controller.pending));
router.post("/:id/accept", authorize("SUPER_ADMIN"), createSaleLimiter, asyncHandler(controller.accept));
router.get("/:id", asyncHandler(controller.detail));

export default router;
