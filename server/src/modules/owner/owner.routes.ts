import { Router } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import * as controller from "./owner.controller.js";

const router = Router();

// Every route here is already gated to role OWNER at the app.ts level (the whole router, same
// pattern as /api/ingredients, /api/users, ...) — nothing inside needs its own authorize() call.
router.get("/sales", asyncHandler(controller.listSales));
router.get("/sales/:id", asyncHandler(controller.saleDetail));
router.post("/sales/:id/items", asyncHandler(controller.addItem));
router.patch("/sales/:id/items/:itemId", asyncHandler(controller.updateItem));
router.post("/sales/:id/items/:itemId/remove", asyncHandler(controller.removeItem));
router.post("/sales/:id/cancel", asyncHandler(controller.cancelSale));

export default router;
