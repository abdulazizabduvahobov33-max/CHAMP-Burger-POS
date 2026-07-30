import type { Prisma } from "@prisma/client";

import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/error.js";
import { isUniqueViolation } from "../../shared/utils/prismaErrors.js";
import type { RecipeLineInput } from "./recipe.schema.js";

type TxClient = Prisma.TransactionClient;

async function assertVariantExists(variantId: string) {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) {
    throw new AppError(404, "NOT_FOUND", "Вариант товара не найден");
  }
  return variant;
}

export async function getRecipe(variantId: string) {
  await assertVariantExists(variantId);

  const lines = await prisma.recipe.findMany({
    where: { variantId },
    include: { ingredient: true },
    orderBy: { ingredient: { name: "asc" } },
  });

  return lines.map((line) => ({
    id: line.id,
    ingredientId: line.ingredientId,
    ingredientName: line.ingredient.name,
    unit: line.ingredient.unit,
    quantity: line.quantity.toString(),
  }));
}

export async function setRecipe(variantId: string, lines: RecipeLineInput[]) {
  await assertVariantExists(variantId);

  if (lines.length > 0) {
    const ingredientIds = lines.map((l) => l.ingredientId);
    const found = await prisma.ingredient.findMany({
      where: { id: { in: ingredientIds }, isActive: true },
      select: { id: true },
    });
    if (found.length !== new Set(ingredientIds).size) {
      throw new AppError(422, "INVALID_INGREDIENT", "Один или несколько ингредиентов не найдены");
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.recipe.deleteMany({ where: { variantId } });
      if (lines.length > 0) {
        await tx.recipe.createMany({
          data: lines.map((l) => ({ variantId, ingredientId: l.ingredientId, quantity: l.quantity })),
        });
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(422, "DUPLICATE_INGREDIENT", "Ингредиент не может повторяться в одном рецепте");
    }
    throw error;
  }

  return getRecipe(variantId);
}

export type DeductedLine = { ingredientId: string; ingredientName: string; amount: string };

/**
 * POS-ready deduction primitive: given a variant sold `saleQuantity` times, deducts every
 * recipe ingredient from stock and logs a StockReason.SALE movement per line.
 *
 * Takes an existing transaction client so callers (Module 6's Sale creation) can compose this
 * with their own writes into ONE atomic transaction — a shortfall on any ingredient, for any
 * item in a multi-item sale, rolls back everything the whole sale already did, not just this
 * one line. `consumeRecipeStock` below is the standalone entry point that opens its own
 * transaction, for callers that just want to deduct in isolation (e.g. direct API testing).
 *
 * Each line uses a conditional `updateMany` (`quantity >= needed`) instead of a separate
 * read-then-write, so concurrent sales of the same ingredient can't both pass a stale
 * sufficiency check and drive stock negative.
 *
 * A variant with no recipe (e.g. a DIRECT-sale drink with no BOM configured) is a no-op —
 * there is nothing to deduct, and callers shouldn't have to special-case it.
 */
export async function deductRecipeIngredients(
  tx: TxClient,
  variantId: string,
  locationId: string,
  saleQuantity: number,
  userId: string,
  referenceId?: string,
): Promise<DeductedLine[]> {
  const lines = await tx.recipe.findMany({ where: { variantId }, include: { ingredient: true } });
  if (lines.length === 0) {
    return [];
  }

  const results: DeductedLine[] = [];

  for (const line of lines) {
    const amount = line.quantity.mul(saleQuantity);

    const result = await tx.stock.updateMany({
      where: { ingredientId: line.ingredientId, locationId, quantity: { gte: amount } },
      data: { quantity: { decrement: amount } },
    });

    if (result.count === 0) {
      throw new AppError(422, "INSUFFICIENT_STOCK", `Недостаточно на складе: ${line.ingredient.name}`);
    }

    await tx.stockMovement.create({
      data: {
        ingredientId: line.ingredientId,
        locationId,
        change: amount.negated(),
        reason: "SALE",
        referenceId,
        createdById: userId,
      },
    });

    results.push({ ingredientId: line.ingredientId, ingredientName: line.ingredient.name, amount: amount.toString() });
  }

  return results;
}

export async function consumeRecipeStock(
  variantId: string,
  locationId: string,
  saleQuantity: number,
  userId: string,
  referenceId?: string,
) {
  await assertVariantExists(variantId);
  const deducted = await prisma.$transaction((tx) =>
    deductRecipeIngredients(tx, variantId, locationId, saleQuantity, userId, referenceId),
  );
  return { deducted };
}
