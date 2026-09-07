import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { restockRecipeIngredientsMock, deductRecipeIngredientsMock, outerSaleFindFirstMock, txMocks } = vi.hoisted(() => {
  const txMocks = {
    queryRaw: vi.fn().mockResolvedValue([{ id: "sale-1" }]),
    saleFindFirst: vi.fn(),
    saleUpdateMany: vi.fn(),
    saleItemFindFirst: vi.fn(),
    saleItemUpdateMany: vi.fn(),
    saleItemFindMany: vi.fn().mockResolvedValue([]),
    saleItemUpdate: vi.fn().mockResolvedValue({ id: "item-1" }),
    saleItemCreate: vi.fn().mockResolvedValue({ id: "item-2" }),
    productVariantFindUnique: vi.fn(),
    recipeFindMany: vi.fn().mockResolvedValue([]),
    saleUpdate: vi.fn().mockResolvedValue({}),
    saleChangeLogCreate: vi.fn().mockResolvedValue({}),
    saleChangeLogCreateMany: vi.fn().mockResolvedValue({}),
  };
  return {
    restockRecipeIngredientsMock: vi.fn().mockResolvedValue([]),
    deductRecipeIngredientsMock: vi.fn().mockResolvedValue([]),
    outerSaleFindFirstMock: vi.fn(),
    txMocks,
  };
});

vi.mock("../../config/db.js", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $queryRaw: txMocks.queryRaw,
        sale: { findFirst: txMocks.saleFindFirst, updateMany: txMocks.saleUpdateMany, update: txMocks.saleUpdate },
        saleItem: {
          findFirst: txMocks.saleItemFindFirst,
          updateMany: txMocks.saleItemUpdateMany,
          findMany: txMocks.saleItemFindMany,
          update: txMocks.saleItemUpdate,
          create: txMocks.saleItemCreate,
        },
        productVariant: { findUnique: txMocks.productVariantFindUnique },
        recipe: { findMany: txMocks.recipeFindMany },
        saleChangeLog: { create: txMocks.saleChangeLogCreate, createMany: txMocks.saleChangeLogCreateMany },
      }),
    sale: { findFirst: outerSaleFindFirstMock },
  },
}));

vi.mock("../recipes/recipe.service.js", () => ({
  restockRecipeIngredients: restockRecipeIngredientsMock,
  deductRecipeIngredients: deductRecipeIngredientsMock,
}));

import { addSaleItem, cancelSale, removeSaleItem, updateSaleItem } from "./owner.service.js";

const FAKE_SALE_DETAIL = {
  id: "sale-1",
  seller: { name: "Продавец" },
  table: null,
  cancelledBy: null,
  totalAmount: "1000",
  status: "CANCELLED",
  createdAt: new Date(),
  acceptedAt: new Date(),
  cancelledAt: new Date(),
  cancelReason: null,
  items: [],
  changeLogs: [],
};

describe("cancelSale — concurrent double-cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMocks.saleFindFirst.mockResolvedValue({ id: "sale-1", status: "ACCEPTED", items: [{ id: "item-1", variantId: "v-1", quantity: 1 }] });
    outerSaleFindFirstMock.mockResolvedValue(FAKE_SALE_DETAIL);
  });

  it("claims the sale via an atomic conditional update BEFORE restocking anything", async () => {
    txMocks.saleUpdateMany.mockResolvedValue({ count: 1 });

    await cancelSale("loc-1", "sale-1", "owner-1", {});

    expect(txMocks.saleUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "sale-1", status: "ACCEPTED" } }));
    expect(restockRecipeIngredientsMock).toHaveBeenCalledTimes(1);
  });

  it("never restocks when a concurrent cancel already won the claim (updateMany count 0)", async () => {
    txMocks.saleUpdateMany.mockResolvedValue({ count: 0 });

    await expect(cancelSale("loc-1", "sale-1", "owner-1", {})).rejects.toMatchObject({ code: "SALE_NOT_CORRECTABLE" });
    expect(restockRecipeIngredientsMock).not.toHaveBeenCalled();
  });
});

describe("removeSaleItem — concurrent double-remove of the same line", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMocks.saleFindFirst.mockResolvedValue({ id: "sale-1", status: "ACCEPTED" });
    txMocks.saleItemFindFirst.mockResolvedValue({
      id: "item-1",
      saleId: "sale-1",
      variantId: "v-1",
      quantity: 1,
      removedAt: null,
      variant: { product: { name: "Cola" } },
    });
    outerSaleFindFirstMock.mockResolvedValue(FAKE_SALE_DETAIL);
  });

  it("claims the line via an atomic conditional update BEFORE restocking", async () => {
    txMocks.saleItemUpdateMany.mockResolvedValue({ count: 1 });

    await removeSaleItem("loc-1", "sale-1", "item-1", "owner-1", {});

    expect(txMocks.saleItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "item-1", removedAt: null } }),
    );
    expect(restockRecipeIngredientsMock).toHaveBeenCalledTimes(1);
  });

  it("never restocks when a concurrent removal already won the claim (updateMany count 0)", async () => {
    txMocks.saleItemUpdateMany.mockResolvedValue({ count: 0 });

    await expect(removeSaleItem("loc-1", "sale-1", "item-1", "owner-1", {})).rejects.toMatchObject({
      code: "ITEM_ALREADY_REMOVED",
    });
    expect(restockRecipeIngredientsMock).not.toHaveBeenCalled();
  });

  it("locks the sale row (SELECT ... FOR UPDATE) before reading anything else", async () => {
    txMocks.saleItemUpdateMany.mockResolvedValue({ count: 1 });

    await removeSaleItem("loc-1", "sale-1", "item-1", "owner-1", {});

    expect(txMocks.queryRaw).toHaveBeenCalledTimes(1);
    const lockOrder = txMocks.queryRaw.mock.invocationCallOrder[0];
    const findFirstOrder = txMocks.saleFindFirst.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(findFirstOrder);
  });
});

describe("updateSaleItem / addSaleItem — recomputeTotal race guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMocks.saleFindFirst.mockResolvedValue({ id: "sale-1", status: "ACCEPTED" });
    txMocks.saleItemFindFirst.mockResolvedValue({
      id: "item-1",
      saleId: "sale-1",
      variantId: "v-1",
      quantity: new Prisma.Decimal(1),
      unitPrice: new Prisma.Decimal(500),
      unitCostSnapshot: new Prisma.Decimal(200),
      removedAt: null,
      variant: { product: { name: "Cola", saleType: "UNIT" } },
    });
    txMocks.productVariantFindUnique.mockResolvedValue({
      id: "v-2",
      isActive: true,
      price: new Prisma.Decimal(700),
      product: { name: "Fanta", isActive: true, saleType: "UNIT" },
    });
    outerSaleFindFirstMock.mockResolvedValue(FAKE_SALE_DETAIL);
  });

  it("updateSaleItem locks the sale row (SELECT ... FOR UPDATE) before reading anything else — this is what closes the lost-update race proven in prisma/reportsAudit.ts (scenario E)", async () => {
    await updateSaleItem("loc-1", "sale-1", "item-1", "owner-1", { quantity: 3 });

    expect(txMocks.queryRaw).toHaveBeenCalledTimes(1);
    const lockOrder = txMocks.queryRaw.mock.invocationCallOrder[0];
    const findFirstOrder = txMocks.saleFindFirst.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(findFirstOrder);
    expect(txMocks.saleItemFindMany).toHaveBeenCalled(); // recomputeTotal still runs
  });

  it("addSaleItem locks the sale row (SELECT ... FOR UPDATE) before reading anything else", async () => {
    await addSaleItem("loc-1", "sale-1", "owner-1", { variantId: "v-2", quantity: 1 });

    expect(txMocks.queryRaw).toHaveBeenCalledTimes(1);
    const lockOrder = txMocks.queryRaw.mock.invocationCallOrder[0];
    const findFirstOrder = txMocks.saleFindFirst.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(findFirstOrder);
    expect(txMocks.saleItemFindMany).toHaveBeenCalled();
  });
});
