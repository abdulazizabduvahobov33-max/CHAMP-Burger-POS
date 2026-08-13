import type { Request, Response } from "express";

import * as ownerService from "./owner.service.js";
import {
  addSaleItemSchema,
  cancelSaleSchema,
  listOwnerSalesQuerySchema,
  removeSaleItemSchema,
  updateSaleItemSchema,
} from "./owner.schema.js";

export async function listSales(req: Request, res: Response) {
  const query = listOwnerSalesQuerySchema.parse(req.query);
  const result = await ownerService.listOwnerSales(req.user!.locationId, query);
  res.json(result);
}

export async function saleDetail(req: Request, res: Response) {
  const sale = await ownerService.getOwnerSaleDetail(req.user!.locationId, req.params.id);
  res.json({ sale });
}

export async function removeItem(req: Request, res: Response) {
  const input = removeSaleItemSchema.parse(req.body);
  const sale = await ownerService.removeSaleItem(req.user!.locationId, req.params.id, req.params.itemId, req.user!.sub, input);
  res.json({ sale });
}

export async function updateItem(req: Request, res: Response) {
  const input = updateSaleItemSchema.parse(req.body);
  const sale = await ownerService.updateSaleItem(req.user!.locationId, req.params.id, req.params.itemId, req.user!.sub, input);
  res.json({ sale });
}

export async function addItem(req: Request, res: Response) {
  const input = addSaleItemSchema.parse(req.body);
  const sale = await ownerService.addSaleItem(req.user!.locationId, req.params.id, req.user!.sub, input);
  res.json({ sale });
}

export async function cancelSale(req: Request, res: Response) {
  const input = cancelSaleSchema.parse(req.body);
  const sale = await ownerService.cancelSale(req.user!.locationId, req.params.id, req.user!.sub, input);
  res.json({ sale });
}
