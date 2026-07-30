import { Router } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import * as controller from "./report.controller.js";

const router = Router();

router.get("/dashboard", asyncHandler(controller.dashboard));
router.get("/sales", asyncHandler(controller.salesList));
router.get("/sales/:id", asyncHandler(controller.saleDetail));
router.get("/top-products", asyncHandler(controller.topProducts));
router.get("/profit", asyncHandler(controller.profitSummary));
router.get("/product-profitability", asyncHandler(controller.productProfitability));
router.get("/ingredient-analytics", asyncHandler(controller.ingredientAnalytics));

export default router;
