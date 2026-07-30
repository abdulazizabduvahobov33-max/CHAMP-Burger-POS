import { Router } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import * as controller from "./ingredient.controller.js";

const router = Router();

router.get("/", asyncHandler(controller.list));
router.post("/", asyncHandler(controller.create));
router.get("/:id", asyncHandler(controller.getOne));
router.patch("/:id", asyncHandler(controller.update));
router.delete("/:id", asyncHandler(controller.remove));
router.post("/:id/restock", asyncHandler(controller.restock));
router.post("/:id/write-off", asyncHandler(controller.writeOff));
router.get("/:id/movements", asyncHandler(controller.movements));

export default router;
