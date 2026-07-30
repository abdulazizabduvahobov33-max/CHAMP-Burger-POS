import { Router } from "express";
import rateLimit from "express-rate-limit";

import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import * as controller from "./ai.controller.js";

const router = Router();

// The local provider is free and cheap, but a future real-LLM provider bills per request —
// cap message sends per user so a runaway client (or later, a paid API key) can't be abused.
const sendMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: "TOO_MANY_MESSAGES", message: "Слишком много сообщений. Подождите немного." },
  },
});

router.get("/messages", asyncHandler(controller.list));
router.post("/messages", sendMessageLimiter, asyncHandler(controller.send));
router.delete("/messages", asyncHandler(controller.clear));

export default router;
