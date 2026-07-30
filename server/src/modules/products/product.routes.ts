import { Router } from "express";

import { authorize } from "../../middleware/authorize.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import * as controller from "./product.controller.js";

const router = Router();

// Reads: any authenticated role (POS needs the menu). Writes: SUPER_ADMIN only.
router.get("/", asyncHandler(controller.list));
router.post("/", authorize("SUPER_ADMIN"), asyncHandler(controller.create));
router.get("/:id", asyncHandler(controller.getOne));
router.patch("/:id", authorize("SUPER_ADMIN"), asyncHandler(controller.update));
router.delete("/:id", authorize("SUPER_ADMIN"), asyncHandler(controller.remove));

export default router;
