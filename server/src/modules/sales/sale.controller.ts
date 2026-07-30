import type { Request, Response } from "express";

import * as saleService from "./sale.service.js";
import { createSaleSchema } from "./sale.schema.js";

export async function create(req: Request, res: Response) {
  const input = createSaleSchema.parse(req.body);
  const sale = await saleService.createSale(req.user!.locationId, req.user!.sub, input.items);
  res.status(201).json({ sale });
}
