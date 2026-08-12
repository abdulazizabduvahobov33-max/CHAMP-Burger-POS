import type { Request, Response } from "express";

import * as tableService from "./table.service.js";
import { createTableSchema, updateTableSchema } from "./table.schema.js";

export async function list(req: Request, res: Response) {
  const tables = await tableService.listTables(req.user!.locationId);
  res.json({ items: tables });
}

export async function create(req: Request, res: Response) {
  const input = createTableSchema.parse(req.body);
  const table = await tableService.createTable(req.user!.locationId, input);
  res.status(201).json({ table });
}

export async function update(req: Request, res: Response) {
  const input = updateTableSchema.parse(req.body);
  const table = await tableService.updateTable(req.user!.locationId, req.params.id, input);
  res.json({ table });
}

export async function remove(req: Request, res: Response) {
  await tableService.deleteTable(req.user!.locationId, req.params.id);
  res.status(204).end();
}
