import type { Request, Response } from "express";

import * as supplierService from "./supplier.service.js";
import { createSupplierSchema, updateSupplierSchema } from "./supplier.schema.js";

export async function list(_req: Request, res: Response) {
  const suppliers = await supplierService.listSuppliers();
  res.json({ items: suppliers });
}

export async function create(req: Request, res: Response) {
  const input = createSupplierSchema.parse(req.body);
  const supplier = await supplierService.createSupplier(input);
  res.status(201).json({ supplier });
}

export async function update(req: Request, res: Response) {
  const input = updateSupplierSchema.parse(req.body);
  const supplier = await supplierService.updateSupplier(req.params.id, input);
  res.json({ supplier });
}

export async function remove(req: Request, res: Response) {
  await supplierService.deleteSupplier(req.params.id);
  res.status(204).end();
}
