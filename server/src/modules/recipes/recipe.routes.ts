import { Router } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import * as controller from "./recipe.controller.js";

const router = Router();

router.get("/:variantId", asyncHandler(controller.getOne));
router.put("/:variantId", asyncHandler(controller.replace));
// POS-ready deduction primitive — not called by any UI yet (no sales flow exists), but exercised
// directly in QA to prove the mechanism ahead of the future POS module.
router.post("/:variantId/consume", asyncHandler(controller.consume));

export default router;
