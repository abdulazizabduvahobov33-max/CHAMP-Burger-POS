import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

import { deductRecipeIngredients, restockRecipeIngredients } from "./recipe.service.js";

function makeFakeTx(recipeLines: { ingredientId: string; quantity: Prisma.Decimal; ingredient: { name: string } }[]) {
  const stockMovementCreate = vi.fn();
  const stockMovementCreateMany = vi.fn().mockResolvedValue({ count: recipeLines.length });
  const stockUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

  const tx = {
    recipe: { findMany: vi.fn().mockResolvedValue(recipeLines) },
    stock: { updateMany: stockUpdateMany },
    stockMovement: { create: stockMovementCreate, createMany: stockMovementCreateMany },
  } as unknown as Prisma.TransactionClient;

  return { tx, stockMovementCreate, stockMovementCreateMany, stockUpdateMany };
}

describe("deductRecipeIngredients", () => {
  it("writes one batched createMany instead of one create() per ingredient line", async () => {
    const lines = [
      { ingredientId: "ing-1", quantity: new Prisma.Decimal(2), ingredient: { name: "Мука" } },
      { ingredientId: "ing-2", quantity: new Prisma.Decimal(1), ingredient: { name: "Сыр" } },
    ];
    const { tx, stockMovementCreate, stockMovementCreateMany, stockUpdateMany } = makeFakeTx(lines);

    const result = await deductRecipeIngredients(tx, "variant-1", "loc-1", 3, "user-1", "ref-1");

    // The per-line sufficiency check must still run once per ingredient, sequentially — this is
    // the overselling guard and must never be batched away.
    expect(stockUpdateMany).toHaveBeenCalledTimes(2);
    expect(stockMovementCreate).not.toHaveBeenCalled();
    expect(stockMovementCreateMany).toHaveBeenCalledTimes(1);
    expect(stockMovementCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ ingredientId: "ing-1", reason: "SALE", referenceId: "ref-1", createdById: "user-1" }),
        expect.objectContaining({ ingredientId: "ing-2", reason: "SALE", referenceId: "ref-1", createdById: "user-1" }),
      ],
    });
    expect(result).toEqual([
      { ingredientId: "ing-1", ingredientName: "Мука", amount: "6" },
      { ingredientId: "ing-2", ingredientName: "Сыр", amount: "3" },
    ]);
  });

  it("throws on insufficient stock and never writes the batched movement", async () => {
    const lines = [{ ingredientId: "ing-1", quantity: new Prisma.Decimal(2), ingredient: { name: "Мука" } }];
    const { tx, stockMovementCreateMany, stockUpdateMany } = makeFakeTx(lines);
    stockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(deductRecipeIngredients(tx, "variant-1", "loc-1", 3, "user-1")).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
    });
    expect(stockMovementCreateMany).not.toHaveBeenCalled();
  });

  it("is a no-op for a variant with no recipe", async () => {
    const { tx, stockMovementCreateMany, stockUpdateMany } = makeFakeTx([]);
    const result = await deductRecipeIngredients(tx, "variant-1", "loc-1", 1, "user-1");
    expect(result).toEqual([]);
    expect(stockUpdateMany).not.toHaveBeenCalled();
    expect(stockMovementCreateMany).not.toHaveBeenCalled();
  });
});

describe("restockRecipeIngredients", () => {
  it("writes one batched createMany instead of one create() per ingredient line", async () => {
    const lines = [
      { ingredientId: "ing-1", quantity: new Prisma.Decimal(2), ingredient: { name: "Мука" } },
      { ingredientId: "ing-2", quantity: new Prisma.Decimal(1), ingredient: { name: "Сыр" } },
    ];
    const { tx, stockMovementCreate, stockMovementCreateMany } = makeFakeTx(lines);

    await restockRecipeIngredients(tx, "variant-1", "loc-1", 2, "user-1", "ref-2");

    expect(stockMovementCreate).not.toHaveBeenCalled();
    expect(stockMovementCreateMany).toHaveBeenCalledTimes(1);
    expect(stockMovementCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ ingredientId: "ing-1", reason: "ADJUST", referenceId: "ref-2" }),
        expect.objectContaining({ ingredientId: "ing-2", reason: "ADJUST", referenceId: "ref-2" }),
      ],
    });
  });
});
