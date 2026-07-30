import type { Request, Response } from "express";

import * as ingredientService from "./ingredient.service.js";
import {
  createIngredientSchema,
  listIngredientsQuerySchema,
  movementsQuerySchema,
  stockAmountSchema,
  updateIngredientSchema,
} from "./ingredient.schema.js";

export async function list(req: Request, res: Response) {
  const query = listIngredientsQuerySchema.parse(req.query);
  const result = await ingredientService.listIngredients(req.user!.locationId, query);
  res.json(result);
}

export async function getOne(req: Request, res: Response) {
  const ingredient = await ingredientService.getIngredient(req.user!.locationId, req.params.id);
  res.json({ ingredient });
}

export async function create(req: Request, res: Response) {
  const input = createIngredientSchema.parse(req.body);
  const ingredient = await ingredientService.createIngredient(req.user!.locationId, input);
  res.status(201).json({ ingredient });
}

export async function update(req: Request, res: Response) {
  const input = updateIngredientSchema.parse(req.body);
  const ingredient = await ingredientService.updateIngredient(req.user!.locationId, req.params.id, input);
  res.json({ ingredient });
}

export async function remove(req: Request, res: Response) {
  await ingredientService.deleteIngredient(req.params.id);
  res.status(204).end();
}

export async function restock(req: Request, res: Response) {
  const input = stockAmountSchema.parse(req.body);
  const ingredient = await ingredientService.restock(req.user!.locationId, req.params.id, req.user!.sub, input);
  res.json({ ingredient });
}

export async function writeOff(req: Request, res: Response) {
  const input = stockAmountSchema.parse(req.body);
  const ingredient = await ingredientService.writeOff(req.user!.locationId, req.params.id, req.user!.sub, input);
  res.json({ ingredient });
}

export async function movements(req: Request, res: Response) {
  const query = movementsQuerySchema.parse(req.query);
  const result = await ingredientService.listMovements(req.user!.locationId, req.params.id, query);
  res.json(result);
}
