import type { Request, Response } from "express";

import * as productService from "./product.service.js";
import { createProductSchema, listProductsQuerySchema, updateProductSchema } from "./product.schema.js";

export async function list(req: Request, res: Response) {
  const query = listProductsQuerySchema.parse(req.query);
  const result = await productService.listProducts(query);
  res.json(result);
}

export async function getOne(req: Request, res: Response) {
  const product = await productService.getProduct(req.params.id);
  res.json({ product });
}

export async function create(req: Request, res: Response) {
  const input = createProductSchema.parse(req.body);
  const product = await productService.createProduct(input);
  res.status(201).json({ product });
}

export async function update(req: Request, res: Response) {
  const input = updateProductSchema.parse(req.body);
  const product = await productService.updateProduct(req.params.id, input);
  res.json({ product });
}

export async function remove(req: Request, res: Response) {
  await productService.deleteProduct(req.params.id);
  res.status(204).end();
}
