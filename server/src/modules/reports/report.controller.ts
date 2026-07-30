import type { Request, Response } from "express";

import * as reportService from "./report.service.js";
import {
  ingredientAnalyticsQuerySchema,
  productProfitabilityQuerySchema,
  profitSummaryQuerySchema,
  salesListQuerySchema,
  topProductsQuerySchema,
} from "./report.schema.js";

export async function dashboard(req: Request, res: Response) {
  const result = await reportService.getDashboardSummary(req.user!.locationId);
  res.json(result);
}

export async function salesList(req: Request, res: Response) {
  const query = salesListQuerySchema.parse(req.query);
  const result = await reportService.listSales(req.user!.locationId, query);
  res.json(result);
}

export async function saleDetail(req: Request, res: Response) {
  const sale = await reportService.getSaleDetail(req.user!.locationId, req.params.id);
  res.json({ sale });
}

export async function topProducts(req: Request, res: Response) {
  const query = topProductsQuerySchema.parse(req.query);
  const items = await reportService.getTopProducts(req.user!.locationId, query);
  res.json({ items });
}

export async function profitSummary(req: Request, res: Response) {
  const query = profitSummaryQuerySchema.parse(req.query);
  const result = await reportService.getProfitSummary(req.user!.locationId, query);
  res.json(result);
}

export async function productProfitability(req: Request, res: Response) {
  const query = productProfitabilityQuerySchema.parse(req.query);
  const result = await reportService.getProductProfitability(req.user!.locationId, query);
  res.json(result);
}

export async function ingredientAnalytics(req: Request, res: Response) {
  const query = ingredientAnalyticsQuerySchema.parse(req.query);
  const result = await reportService.getIngredientAnalytics(req.user!.locationId, query);
  res.json(result);
}
