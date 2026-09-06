import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueOrThrowMock, saleFindUniqueMock, userFindUniqueMock, deductRecipeIngredientsMock, txMocks } =
  vi.hoisted(() => {
    const txMocks = {
      tableFindFirst: vi.fn(),
      variantFindMany: vi.fn(),
      saleCreate: vi.fn(),
      saleItemCreate: vi.fn(),
      saleUpdate: vi.fn().mockResolvedValue({}),
      saleFindFirst: vi.fn(),
      saleUpdateMany: vi.fn(),
    };
    return {
      findUniqueOrThrowMock: vi.fn(),
      saleFindUniqueMock: vi.fn(),
      userFindUniqueMock: vi.fn(),
      deductRecipeIngredientsMock: vi.fn().mockResolvedValue([]),
      txMocks,
    };
  });

vi.mock("../../config/db.js", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        table: { findFirst: txMocks.tableFindFirst },
        productVariant: { findMany: txMocks.variantFindMany },
        sale: {
          create: txMocks.saleCreate,
          update: txMocks.saleUpdate,
          findUniqueOrThrow: findUniqueOrThrowMock,
          findFirst: txMocks.saleFindFirst,
          updateMany: txMocks.saleUpdateMany,
        },
        saleItem: { create: txMocks.saleItemCreate },
      }),
    sale: { findUniqueOrThrow: findUniqueOrThrowMock, findUnique: saleFindUniqueMock },
    user: { findUnique: userFindUniqueMock },
  },
}));

vi.mock("../recipes/recipe.service.js", () => ({
  deductRecipeIngredients: deductRecipeIngredientsMock,
}));

import { acceptSale, createSale, rejectSale } from "./sale.service.js";

const FAKE_SALE_ROW = {
  id: "sale-1",
  totalAmount: new Prisma.Decimal(500),
  cashReceived: null,
  changeGiven: null,
  status: "PENDING",
  acceptedAt: null,
  createdAt: new Date(),
  table: { number: 4 },
  items: [],
};

describe("createSale — non-autoAccept (waiter 'send order') path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMocks.tableFindFirst.mockResolvedValue({ id: "table-1", locationId: "loc-1", isActive: true });
    txMocks.variantFindMany.mockResolvedValue([
      {
        id: "variant-1",
        isActive: true,
        price: new Prisma.Decimal(500),
        product: { name: "Cola", isActive: true, saleType: "UNIT" },
      },
    ]);
    txMocks.saleCreate.mockResolvedValue({ id: "sale-1" });
    txMocks.saleItemCreate.mockResolvedValue({ id: "item-1" });
    saleFindUniqueMock.mockResolvedValue(null);
    findUniqueOrThrowMock.mockResolvedValue(FAKE_SALE_ROW);
  });

  it("fetches the sale and the seller's name concurrently, not one after the other", async () => {
    const callOrder: string[] = [];
    let resolveSale!: (value: unknown) => void;
    let resolveUser!: (value: unknown) => void;

    findUniqueOrThrowMock.mockImplementation(() => {
      callOrder.push("sale-called");
      return new Promise((resolve) => {
        resolveSale = () => resolve(FAKE_SALE_ROW);
      });
    });
    userFindUniqueMock.mockImplementation(() => {
      callOrder.push("user-called");
      return new Promise((resolve) => {
        resolveUser = () => resolve({ name: "Официант Иван" });
      });
    });

    const pending = createSale("loc-1", "seller-1", [{ variantId: "variant-1", quantity: 1 }], undefined, false, "table-1");

    // Give the transaction + the post-transaction Promise.all a tick to fire both underlying
    // calls. If this were still sequential (await getSale() THEN await user.findUnique()), only
    // "sale-called" would be present here — the second call wouldn't happen until the first
    // one's promise resolves, which it deliberately never does in this test.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(callOrder).toEqual(["sale-called", "user-called"]);

    resolveSale(undefined);
    resolveUser(undefined);
    const result = await pending;
    expect(result.id).toBe("sale-1");
  });
});

describe("createSale — idempotency (clientRequestId)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMocks.tableFindFirst.mockResolvedValue({ id: "table-1", locationId: "loc-1", isActive: true });
    txMocks.variantFindMany.mockResolvedValue([
      {
        id: "variant-1",
        isActive: true,
        price: new Prisma.Decimal(500),
        product: { name: "Cola", isActive: true, saleType: "UNIT" },
      },
    ]);
    txMocks.saleCreate.mockResolvedValue({ id: "new-sale" });
    txMocks.saleItemCreate.mockResolvedValue({ id: "item-1" });
    findUniqueOrThrowMock.mockResolvedValue(FAKE_SALE_ROW);
  });

  it("returns the existing sale without opening a transaction when a sale with this clientRequestId already exists", async () => {
    saleFindUniqueMock.mockResolvedValue({ id: "sale-1" });

    const result = await createSale("loc-1", "admin-1", [{ variantId: "variant-1", quantity: 1 }], 500, true, undefined, "key-abc");

    expect(saleFindUniqueMock).toHaveBeenCalledWith({ where: { clientRequestId: "key-abc" } });
    expect(txMocks.saleCreate).not.toHaveBeenCalled();
    expect(result.id).toBe("sale-1");
  });

  it("on a unique-constraint conflict (lost the race to a concurrent identical request), returns the winner's sale instead of throwing or duplicating", async () => {
    saleFindUniqueMock.mockResolvedValue(null); // no existing row when this attempt started
    const conflictError = Object.assign(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.22.0",
      }),
      {},
    );
    txMocks.saleCreate.mockRejectedValue(conflictError);
    findUniqueOrThrowMock.mockResolvedValueOnce({ id: "winner-sale" }).mockResolvedValueOnce(FAKE_SALE_ROW);

    const result = await createSale("loc-1", "admin-1", [{ variantId: "variant-1", quantity: 1 }], 500, true, undefined, "key-xyz");

    expect(result.id).toBe("sale-1"); // FAKE_SALE_ROW's id, fetched via getSale(winner.id)
  });

  it("a real caller with no clientRequestId behaves exactly as before (no dedup lookup)", async () => {
    await createSale("loc-1", "admin-1", [{ variantId: "variant-1", quantity: 1 }], 500, true);

    expect(saleFindUniqueMock).not.toHaveBeenCalled();
    expect(txMocks.saleCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ clientRequestId: null }) }));
  });
});

describe("acceptSale — concurrent double-accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMocks.saleFindFirst.mockResolvedValue({
      id: "sale-1",
      sellerId: "seller-1",
      status: "PENDING",
      totalAmount: new Prisma.Decimal(500),
      items: [{ variantId: "variant-1", quantity: new Prisma.Decimal(1), id: "item-1" }],
    });
    findUniqueOrThrowMock.mockResolvedValue(FAKE_SALE_ROW);
  });

  it("claims the sale via an atomic conditional update BEFORE deducting stock", async () => {
    txMocks.saleUpdateMany.mockResolvedValue({ count: 1 });

    await acceptSale("loc-1", "sale-1", 500);

    expect(txMocks.saleUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sale-1", status: "PENDING" } }),
    );
    expect(deductRecipeIngredientsMock).toHaveBeenCalledTimes(1);
  });

  it("never deducts stock when a concurrent accept already won the claim (updateMany count 0)", async () => {
    txMocks.saleUpdateMany.mockResolvedValue({ count: 0 });

    await expect(acceptSale("loc-1", "sale-1", 500)).rejects.toMatchObject({ code: "ALREADY_HANDLED" });
    expect(deductRecipeIngredientsMock).not.toHaveBeenCalled();
  });
});

describe("rejectSale — concurrent double-reject / accept-vs-reject race", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMocks.saleFindFirst.mockResolvedValue({ id: "sale-1", sellerId: "seller-1", status: "PENDING" });
    findUniqueOrThrowMock.mockResolvedValue(FAKE_SALE_ROW);
  });

  it("never reports success when a concurrent accept/reject already won the claim (updateMany count 0)", async () => {
    txMocks.saleUpdateMany.mockResolvedValue({ count: 0 });

    await expect(rejectSale("loc-1", "sale-1")).rejects.toMatchObject({ code: "ALREADY_HANDLED" });
  });
});
