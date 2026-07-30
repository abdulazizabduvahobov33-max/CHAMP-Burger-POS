import { Router } from "express";
import rateLimit from "express-rate-limit";

import { authenticate } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import * as controller from "./auth.controller.js";

const router = Router();

// Brute-force guard, scoped to login attempts (tighter than the app-wide limiter).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: "TOO_MANY_ATTEMPTS", message: "Слишком много попыток входа. Попробуйте позже." },
  },
});

router.post("/login", loginLimiter, asyncHandler(controller.login));
router.post("/refresh", asyncHandler(controller.refresh));
router.post("/logout", asyncHandler(controller.logout));
router.get("/me", authenticate, asyncHandler(controller.me));
router.post("/change-password", authenticate, asyncHandler(controller.changePassword));

export default router;
