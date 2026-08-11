import { Router } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import * as controller from "./notification.controller.js";

const router = Router();

// No `authenticate` middleware here on purpose — the SSE stream authenticates itself from a
// query-string token instead of the usual Authorization header (see notification.controller.ts
// for why). Every other route in this app keeps the header-only rule; this is the one exception.
router.get("/stream", asyncHandler(controller.stream));

export default router;
