import type { Request, Response } from "express";

import * as saleService from "./sale.service.js";
import { createSaleSchema, listMySalesQuerySchema } from "./sale.schema.js";

export async function create(req: Request, res: Response) {
  const input = createSaleSchema.parse(req.body);
  const sale = await saleService.createSale(req.user!.locationId, req.user!.sub, input.items, input.cashReceived);
  res.status(201).json({ sale });
}

export async function list(req: Request, res: Response) {
  const query = listMySalesQuerySchema.parse(req.query);
  const result = await saleService.listMySales(req.user!.sub, query.page, query.pageSize);
  res.json(result);
}

export async function detail(req: Request, res: Response) {
  const sale = await saleService.getMySale(req.params.id, req.user!.sub);
  res.json({ sale });
}
