import type { Request, Response } from "express";

import * as purchaseService from "./purchase.service.js";
import { createPurchaseSchema, listPurchasesQuerySchema } from "./purchase.schema.js";

export async function list(req: Request, res: Response) {
  const query = listPurchasesQuerySchema.parse(req.query);
  const result = await purchaseService.listPurchases(req.user!.locationId, query);
  res.json(result);
}

export async function getOne(req: Request, res: Response) {
  const purchase = await purchaseService.getPurchase(req.user!.locationId, req.params.id);
  res.json({ purchase });
}

export async function create(req: Request, res: Response) {
  const input = createPurchaseSchema.parse(req.body);
  const purchase = await purchaseService.createPurchase(req.user!.locationId, req.user!.sub, input);
  res.status(201).json({ purchase });
}
