import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueOrThrowMock, userFindUniqueMock, txMocks } = vi.hoisted(() => {
  const txMocks = {
    tableFindFirst: vi.fn(),
    variantFindMany: vi.fn(),
    saleCreate: vi.fn(),
    saleItemCreate: vi.fn(),
    saleUpdate: vi.fn().mockResolvedValue({}),
  };
  return {
    findUniqueOrThrowMock: vi.fn(),
    userFindUniqueMock: vi.fn(),
    txMocks,
  };
});

vi.mock("../../config/db.js", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        table: { findFirst: txMocks.tableFindFirst },
        productVariant: { findMany: txMocks.variantFindMany },
        sale: { create: txMocks.saleCreate, update: txMocks.saleUpdate, findUniqueOrThrow: findUniqueOrThrowMock },
        saleItem: { create: txMocks.saleItemCreate },
      }),
    sale: { findUniqueOrThrow: findUniqueOrThrowMock },
    user: { findUnique: userFindUniqueMock },
  },
}));

import { createSale } from "./sale.service.js";

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
