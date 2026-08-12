import type { Request, Response } from "express";

import * as saleService from "./sale.service.js";
import { acceptSaleSchema, createSaleSchema, listMySalesQuerySchema } from "./sale.schema.js";

export async function create(req: Request, res: Response) {
  const input = createSaleSchema.parse(req.body);
  // A SUPER_ADMIN using the register ("Оформление заказа") rings the sale up immediately;
  // a SELLER's checkout only ever sends it for a SUPER_ADMIN to accept — role-derived, never a
  // client-supplied flag, so a seller's own request can't mark its own order pre-accepted.
  const autoAccept = req.user!.role === "SUPER_ADMIN";
  const sale = await saleService.createSale(
    req.user!.locationId,
    req.user!.sub,
    input.items,
    input.cashReceived,
    autoAccept,
    input.tableId,
  );
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

export async function pending(req: Request, res: Response) {
  const items = await saleService.listPendingSales(req.user!.locationId);
  res.json({ items });
}

export async function accept(req: Request, res: Response) {
  const input = acceptSaleSchema.parse(req.body);
  const sale = await saleService.acceptSale(req.user!.locationId, req.params.id, input.cashReceived);
  res.json({ sale });
}

export async function reject(req: Request, res: Response) {
  const sale = await saleService.rejectSale(req.user!.locationId, req.params.id);
  res.json({ sale });
}
