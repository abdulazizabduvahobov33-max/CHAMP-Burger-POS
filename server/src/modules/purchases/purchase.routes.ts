import { Router } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import * as controller from "./purchase.controller.js";

const router = Router();

router.get("/", asyncHandler(controller.list));
router.post("/", asyncHandler(controller.create));
router.get("/:id", asyncHandler(controller.getOne));

export default router;
