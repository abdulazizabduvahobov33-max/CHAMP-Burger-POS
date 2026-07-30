import { Prisma } from "@prisma/client";

import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/error.js";
import { deductRecipeIngredients } from "../recipes/recipe.service.js";
import type { SaleItemInput } from "./sale.schema.js";

type SaleWithItems = Prisma.SaleGetPayload<{
  include: { items: { include: { variant: { include: { product: true } } } } };
}>;

function serializeSale(sale: SaleWithItems) {
  return {
    id: sale.id,
    totalAmount: sale.totalAmount.toString(),
    createdAt: sale.createdAt,
    items: sale.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      productName: item.variant.product.name,
      variantLabel: item.variant.label,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      subtotal: item.subtotal.toString(),
    })),
  };
}

export async function getSale(id: string) {
  const sale = await prisma.sale.findUniqueOrThrow({
    where: { id },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
  return serializeSale(sale);
}

/**
 * Creates a Sale + its SaleItems and deducts every item's recipe ingredients from stock —
 * all in ONE transaction. If any single item can't be fulfilled (product deactivated mid-order,
 * or any ingredient anywhere in the cart runs short), the whole sale is rolled back: no Sale,
 * no SaleItems, no partial stock deduction. Prices are always looked up server-side from the
 * variant's current price — the client only ever sends variantId + quantity, never a price.
 *
 * The variant lookup (existence, active state, price) happens INSIDE the transaction rather
 * than as a pre-check — otherwise a concurrent price change or product deactivation landing in
 * the gap between a pre-check and the transaction opening would silently go unnoticed, charging
 * a stale price or selling a now-unavailable item.
 */
export async function createSale(locationId: string, sellerId: string, items: SaleItemInput[]) {
  // Defensive: collapse accidental duplicate variantId entries in one request instead of
  // trusting the client to have already aggregated quantities per line.
  const merged = new Map<string, number>();
  for (const item of items) {
    merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity);
  }
  const variantIds = [...merged.keys()];

  const saleId = await prisma.$transaction(async (tx) => {
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    for (const variantId of variantIds) {
      const variant = variantMap.get(variantId);
      if (!variant) {
        throw new AppError(404, "NOT_FOUND", "Один из товаров в корзине не найден");
      }
      if (!variant.isActive || !variant.product.isActive) {
        throw new AppError(422, "PRODUCT_INACTIVE", `«${variant.product.name}» больше недоступен для продажи`);
      }
      // Only WEIGHT-type products (sold by weight, e.g. Kefsi) are meant to take a fractional
      // quantity — the schema itself can't express this since it doesn't know the variant's
      // saleType without a DB lookup, so it's enforced here instead, once the variant is loaded.
      if (variant.product.saleType !== "WEIGHT" && !Number.isInteger(merged.get(variantId))) {
        throw new AppError(422, "INVALID_QUANTITY", `«${variant.product.name}» продаётся только целым количеством`);
      }
    }

    const sale = await tx.sale.create({ data: { sellerId, locationId, totalAmount: 0 } });

    let totalAmount = new Prisma.Decimal(0);
    for (const [variantId, quantity] of merged) {
      const variant = variantMap.get(variantId)!;
      const unitPrice = variant.price;
      const subtotal = unitPrice.mul(quantity);
      totalAmount = totalAmount.add(subtotal);

      const saleItem = await tx.saleItem.create({
        data: { saleId: sale.id, variantId, quantity, unitPrice, subtotal },
      });

      // Same recipe-deduction primitive Module 5 built and race-tested, now composed into
      // this larger transaction instead of opening its own — see recipe.service.ts.
      await deductRecipeIngredients(tx, variantId, locationId, quantity, sellerId, saleItem.id);
    }

    await tx.sale.update({ where: { id: sale.id }, data: { totalAmount } });
    return sale.id;
  });

  return getSale(saleId);
}
