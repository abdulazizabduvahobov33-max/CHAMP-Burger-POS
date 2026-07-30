import type { Request, Response } from "express";

import * as recipeService from "./recipe.service.js";
import { consumeRecipeSchema, setRecipeSchema } from "./recipe.schema.js";

export async function getOne(req: Request, res: Response) {
  const items = await recipeService.getRecipe(req.params.variantId);
  res.json({ items });
}

export async function replace(req: Request, res: Response) {
  const { lines } = setRecipeSchema.parse(req.body);
  const items = await recipeService.setRecipe(req.params.variantId, lines);
  res.json({ items });
}

export async function consume(req: Request, res: Response) {
  const input = consumeRecipeSchema.parse(req.body);
  const result = await recipeService.consumeRecipeStock(
    req.params.variantId,
    req.user!.locationId,
    input.quantity,
    req.user!.sub,
    input.referenceId,
  );
  res.json(result);
}
