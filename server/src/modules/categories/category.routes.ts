import { Router } from "express";

import { authorize } from "../../middleware/authorize.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import * as controller from "./category.controller.js";

const router = Router();

// Reads: any authenticated role (POS needs the category filter). Writes: SUPER_ADMIN only.
router.get("/", asyncHandler(controller.list));
router.post("/", authorize("SUPER_ADMIN"), asyncHandler(controller.create));
router.patch("/:id", authorize("SUPER_ADMIN"), asyncHandler(controller.update));
router.delete("/:id", authorize("SUPER_ADMIN"), asyncHandler(controller.remove));

export default router;
