import { Router } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import * as controller from "./settings.controller.js";

const router = Router();

router.get("/", asyncHandler(controller.get));
router.patch("/", asyncHandler(controller.update));
router.get("/system-info", asyncHandler(controller.systemInfo));

export default router;
