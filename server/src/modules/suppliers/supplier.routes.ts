import { Router } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import * as controller from "./supplier.controller.js";

const router = Router();

router.get("/", asyncHandler(controller.list));
router.post("/", asyncHandler(controller.create));
router.patch("/:id", asyncHandler(controller.update));
router.delete("/:id", asyncHandler(controller.remove));

export default router;
