import type { Request, Response } from "express";

import * as categoryService from "./category.service.js";
import { createCategorySchema, updateCategorySchema } from "./category.schema.js";

export async function list(_req: Request, res: Response) {
  const categories = await categoryService.listCategories();
  res.json({ items: categories });
}

export async function create(req: Request, res: Response) {
  const input = createCategorySchema.parse(req.body);
  const category = await categoryService.createCategory(input);
  res.status(201).json({ category });
}

export async function update(req: Request, res: Response) {
  const input = updateCategorySchema.parse(req.body);
  const category = await categoryService.updateCategory(req.params.id, input);
  res.json({ category });
}

export async function remove(req: Request, res: Response) {
  await categoryService.deleteCategory(req.params.id);
  res.status(204).end();
}
