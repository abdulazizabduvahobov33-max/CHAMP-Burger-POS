import { Prisma } from "@prisma/client";

import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/error.js";
import { isUniqueViolation } from "../../shared/utils/prismaErrors.js";
import type {
  CreateIngredientInput,
  ListIngredientsQuery,
  MovementsQuery,
  StockAmountInput,
  UpdateIngredientInput,
} from "./ingredient.schema.js";

function serializeIngredient(ingredient: {
  id: string;
  name: string;
  unit: string;
  minQuantity: Prisma.Decimal;
  isActive: boolean;
  createdAt: Date;
  stock: { quantity: Prisma.Decimal }[];
}) {
  const quantity = ingredient.stock[0]?.quantity ?? new Prisma.Decimal(0);
  return {
    id: ingredient.id,
    name: ingredient.name,
    unit: ingredient.unit,
    minQuantity: ingredient.minQuantity.toString(),
    quantity: quantity.toString(),
    isLow: quantity.lessThan(ingredient.minQuantity),
    isActive: ingredient.isActive,
    createdAt: ingredient.createdAt,
  };
}

export async function listIngredients(locationId: string, query: ListIngredientsQuery) {
  const where: Prisma.IngredientWhereInput = {
    isActive: true,
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    ...(query.unit ? { unit: query.unit } : {}),
  };

  const ingredients = await prisma.ingredient.findMany({
    where,
    include: { stock: { where: { locationId } } },
    orderBy: { name: "asc" },
  });

  let rows = ingredients.map(serializeIngredient);
  if (query.lowStock) {
    rows = rows.filter((r) => r.isLow);
  }

  const total = rows.length;
  const start = (query.page - 1) * query.pageSize;
  const items = rows.slice(start, start + query.pageSize);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

async function findActiveIngredient(id: string) {
  const ingredient = await prisma.ingredient.findFirst({ where: { id, isActive: true } });
  if (!ingredient) {
    throw new AppError(404, "NOT_FOUND", "Ингредиент не найден");
  }
  return ingredient;
}

export async function getIngredient(locationId: string, id: string) {
  const ingredient = await prisma.ingredient.findFirst({
    where: { id, isActive: true },
    include: { stock: { where: { locationId } } },
  });
  if (!ingredient) {
    throw new AppError(404, "NOT_FOUND", "Ингредиент не найден");
  }
  return serializeIngredient(ingredient);
}

const DUPLICATE_NAME_MESSAGE = "Ингредиент с таким названием уже существует";

async function assertNameAvailable(name: string, excludeId?: string) {
  const existing = await prisma.ingredient.findFirst({
    where: {
      isActive: true,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new AppError(409, "DUPLICATE_NAME", DUPLICATE_NAME_MESSAGE);
  }
}

export async function createIngredient(locationId: string, input: CreateIngredientInput) {
  await assertNameAvailable(input.name);

  try {
    const ingredient = await prisma.$transaction(async (tx) => {
      const created = await tx.ingredient.create({
        data: { name: input.name, unit: input.unit, minQuantity: input.minQuantity },
      });
      await tx.stock.create({ data: { ingredientId: created.id, locationId, quantity: 0 } });
      return created;
    });

    return await getIngredient(locationId, ingredient.id);
  } catch (error) {
    // Fallback for the race window between assertNameAvailable and this insert — closed by
    // the partial case-insensitive unique index (migration ingredient_name_ci_unique).
    if (isUniqueViolation(error)) {
      throw new AppError(409, "DUPLICATE_NAME", DUPLICATE_NAME_MESSAGE);
    }
    throw error;
  }
}

export async function updateIngredient(locationId: string, id: string, input: UpdateIngredientInput) {
  await findActiveIngredient(id);
  if (input.name) {
    await assertNameAvailable(input.name, id);
  }

  try {
    await prisma.ingredient.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.unit ? { unit: input.unit } : {}),
        ...(input.minQuantity !== undefined ? { minQuantity: input.minQuantity } : {}),
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "DUPLICATE_NAME", DUPLICATE_NAME_MESSAGE);
    }
    throw error;
  }

  return getIngredient(locationId, id);
}

export async function deleteIngredient(id: string) {
  await findActiveIngredient(id);

  const recipeCount = await prisma.recipe.count({
    where: { ingredientId: id, variant: { isActive: true, product: { isActive: true } } },
  });
  if (recipeCount > 0) {
    throw new AppError(
      409,
      "INGREDIENT_IN_USE",
      `Нельзя удалить: ингредиент используется в ${recipeCount} рецепт(ах)`,
    );
  }

  await prisma.ingredient.update({ where: { id }, data: { isActive: false } });
}

export async function restock(locationId: string, ingredientId: string, userId: string, input: StockAmountInput) {
  await findActiveIngredient(ingredientId);

  await prisma.$transaction([
    prisma.stock.upsert({
      where: { ingredientId_locationId: { ingredientId, locationId } },
      create: { ingredientId, locationId, quantity: input.quantity },
      update: { quantity: { increment: input.quantity } },
    }),
    prisma.stockMovement.create({
      data: {
        ingredientId,
        locationId,
        change: input.quantity,
        reason: "PURCHASE",
        note: input.note,
        createdById: userId,
      },
    }),
  ]);

  return getIngredient(locationId, ingredientId);
}

export async function writeOff(locationId: string, ingredientId: string, userId: string, input: StockAmountInput) {
  await findActiveIngredient(ingredientId);

  // Conditional atomic decrement (same pattern as recipe stock deduction): the `gte` guard
  // and the decrement happen in one statement, so two concurrent write-offs against the same
  // tight stock can't both pass a separate read-then-write check and drive quantity negative.
  await prisma.$transaction(async (tx) => {
    const result = await tx.stock.updateMany({
      where: { ingredientId, locationId, quantity: { gte: input.quantity } },
      data: { quantity: { decrement: input.quantity } },
    });

    if (result.count === 0) {
      const stock = await tx.stock.findUnique({ where: { ingredientId_locationId: { ingredientId, locationId } } });
      const current = stock?.quantity ?? new Prisma.Decimal(0);
      throw new AppError(422, "INSUFFICIENT_STOCK", `Недостаточно на складе: доступно ${current.toString()}`);
    }

    await tx.stockMovement.create({
      data: {
        ingredientId,
        locationId,
        change: -input.quantity,
        reason: "WASTE",
        note: input.note,
        createdById: userId,
      },
    });
  });

  return getIngredient(locationId, ingredientId);
}

export async function listMovements(locationId: string, ingredientId: string, query: MovementsQuery) {
  await findActiveIngredient(ingredientId);

  // Scoped by location, same as every sibling operation in this file (restock/writeOff/
  // getIngredient) — schema is multi-location-ready even though only one location is seeded
  // today, so movements from a future second location must not leak into this one's history.
  const where: Prisma.StockMovementWhereInput = { ingredientId, locationId };
  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  const items = rows.map((m) => ({
    id: m.id,
    change: m.change.toString(),
    reason: m.reason,
    note: m.note,
    createdAt: m.createdAt,
    createdByName: m.createdBy.name,
  }));

  return { items, total, page: query.page, pageSize: query.pageSize };
}
