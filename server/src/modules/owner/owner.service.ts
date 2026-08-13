import { Prisma } from "@prisma/client";

import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/error.js";
import { shortReceiptNumber } from "../../shared/utils/receiptNumber.js";
import { deductRecipeIngredients, restockRecipeIngredients } from "../recipes/recipe.service.js";
import type {
  AddSaleItemInput,
  CancelSaleInput,
  ListOwnerSalesQuery,
  RemoveSaleItemInput,
  UpdateSaleItemInput,
} from "./owner.schema.js";

type TxClient = Prisma.TransactionClient;

/**
 * Everything in this module is the ONE place the app allows an already-ACCEPTED sale's numbers
 * to change after the fact — and even here, nothing is ever a DELETE. An item is soft-removed
 * (SaleItem.removedAt), a whole sale is soft-cancelled (Sale.status = CANCELLED), and every
 * single mutation writes one permanent SaleChangeLog row before returning. Gated to role OWNER
 * only at the route level (owner.routes.ts) — a SUPER_ADMIN literally cannot reach any function
 * here through the API, regardless of what the client sends.
 */

const includeForDetail = {
  seller: { select: { name: true } },
  table: { select: { number: true } },
  cancelledBy: { select: { name: true } },
  items: { include: { variant: { include: { product: true } }, removedBy: { select: { name: true } } } },
  changeLogs: { include: { performedBy: { select: { name: true } } }, orderBy: { performedAt: "asc" as const } },
};

type SaleForOwner = Prisma.SaleGetPayload<{ include: typeof includeForDetail }>;

function serializeSaleDetail(sale: SaleForOwner) {
  return {
    id: sale.id,
    receiptNumber: shortReceiptNumber(sale.id),
    tableNumber: sale.table?.number ?? null,
    sellerName: sale.seller.name,
    totalAmount: sale.totalAmount.toString(),
    status: sale.status,
    createdAt: sale.createdAt,
    acceptedAt: sale.acceptedAt,
    cancelledAt: sale.cancelledAt,
    cancelledByName: sale.cancelledBy?.name ?? null,
    cancelReason: sale.cancelReason,
    items: sale.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      productName: item.variant.product.name,
      variantLabel: item.variant.label,
      saleType: item.variant.product.saleType,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      subtotal: item.subtotal.toString(),
      removedAt: item.removedAt,
      removedByName: item.removedBy?.name ?? null,
      removeReason: item.removeReason,
    })),
    changeLogs: sale.changeLogs.map((log) => ({
      id: log.id,
      changeType: log.changeType,
      description: log.description,
      oldValue: log.oldValue,
      newValue: log.newValue,
      reason: log.reason,
      performedByName: log.performedBy.name,
      performedAt: log.performedAt,
    })),
  };
}

export async function listOwnerSales(locationId: string, query: ListOwnerSalesQuery) {
  const where: Prisma.SaleWhereInput = {
    locationId,
    // The owner panel is a correction tool for finalized orders — PENDING/REJECTED sales belong
    // to the separate pending-orders queue (also OWNER-reachable, see sale.routes.ts), not here.
    // CANCELLED sales stay visible (not filtered out) so the owner can always see what they
    // already cancelled, not just what's still active.
    status: { in: ["ACCEPTED", "CANCELLED"] },
    ...(query.search ? { seller: { name: { contains: query.search, mode: "insensitive" } } } : {}),
  };

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        totalAmount: true,
        status: true,
        seller: { select: { name: true } },
        table: { select: { number: true } },
        _count: { select: { items: { where: { removedAt: null } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.sale.count({ where }),
  ]);

  return {
    items: sales.map((s) => ({
      id: s.id,
      receiptNumber: shortReceiptNumber(s.id),
      tableNumber: s.table?.number ?? null,
      sellerName: s.seller.name,
      createdAt: s.createdAt,
      totalAmount: s.totalAmount.toString(),
      status: s.status,
      itemCount: s._count.items,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

async function findOwnerSaleOrThrow(locationId: string, id: string): Promise<SaleForOwner> {
  const sale = await prisma.sale.findFirst({ where: { id, locationId }, include: includeForDetail });
  if (!sale) {
    throw new AppError(404, "NOT_FOUND", "Продажа не найдена");
  }
  return sale;
}

export async function getOwnerSaleDetail(locationId: string, id: string) {
  const sale = await findOwnerSaleOrThrow(locationId, id);
  return serializeSaleDetail(sale);
}

async function recomputeTotal(tx: TxClient, saleId: string): Promise<Prisma.Decimal> {
  const items = await tx.saleItem.findMany({ where: { saleId, removedAt: null }, select: { subtotal: true } });
  const total = items.reduce((sum, item) => sum.add(item.subtotal), new Prisma.Decimal(0));
  await tx.sale.update({ where: { id: saleId }, data: { totalAmount: total } });
  return total;
}

function money(value: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(value).toString();
}

export async function removeSaleItem(
  locationId: string,
  saleId: string,
  itemId: string,
  ownerId: string,
  input: RemoveSaleItemInput,
) {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id: saleId, locationId } });
    if (!sale) throw new AppError(404, "NOT_FOUND", "Продажа не найдена");
    if (sale.status !== "ACCEPTED") throw new AppError(409, "SALE_NOT_CORRECTABLE", "Исправления доступны только для оформленных продаж");

    const item = await tx.saleItem.findFirst({
      where: { id: itemId, saleId },
      include: { variant: { include: { product: true } } },
    });
    if (!item) throw new AppError(404, "NOT_FOUND", "Позиция не найдена");
    if (item.removedAt) throw new AppError(409, "ITEM_ALREADY_REMOVED", "Позиция уже удалена");

    await restockRecipeIngredients(tx, item.variantId, locationId, Number(item.quantity), ownerId, item.id);

    await tx.saleItem.update({
      where: { id: item.id },
      data: { removedAt: new Date(), removedById: ownerId, removeReason: input.reason ?? null },
    });

    await recomputeTotal(tx, saleId);

    const label = `${item.variant.product.name} ×${item.quantity.toString()}`;
    await tx.saleChangeLog.create({
      data: {
        saleId,
        saleItemId: item.id,
        changeType: "ITEM_REMOVED",
        description: `Удалён товар: ${label}`,
        oldValue: label,
        newValue: null,
        reason: input.reason ?? null,
        performedById: ownerId,
      },
    });
  });

  return getOwnerSaleDetail(locationId, saleId);
}

export async function updateSaleItem(
  locationId: string,
  saleId: string,
  itemId: string,
  ownerId: string,
  input: UpdateSaleItemInput,
) {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id: saleId, locationId } });
    if (!sale) throw new AppError(404, "NOT_FOUND", "Продажа не найдена");
    if (sale.status !== "ACCEPTED") throw new AppError(409, "SALE_NOT_CORRECTABLE", "Исправления доступны только для оформленных продаж");

    const item = await tx.saleItem.findFirst({
      where: { id: itemId, saleId },
      include: { variant: { include: { product: true } } },
    });
    if (!item) throw new AppError(404, "NOT_FOUND", "Позиция не найдена");
    if (item.removedAt) throw new AppError(409, "ITEM_ALREADY_REMOVED", "Позиция уже удалена");

    const productName = item.variant.product.name;
    const logs: Prisma.SaleChangeLogCreateManyInput[] = [];

    let newQuantity = item.quantity;
    if (input.quantity !== undefined) {
      const nextQuantity = new Prisma.Decimal(input.quantity);
      if (item.variant.product.saleType !== "WEIGHT" && !Number.isInteger(input.quantity)) {
        throw new AppError(422, "INVALID_QUANTITY", `«${productName}» продаётся только целым количеством`);
      }
      const delta = nextQuantity.sub(item.quantity);
      if (!delta.isZero()) {
        if (delta.isPositive()) {
          await deductRecipeIngredients(tx, item.variantId, locationId, delta.toNumber(), ownerId, item.id);
        } else {
          await restockRecipeIngredients(tx, item.variantId, locationId, delta.neg().toNumber(), ownerId, item.id);
        }
        logs.push({
          saleId,
          saleItemId: item.id,
          changeType: "QUANTITY_CHANGED",
          description: `Количество изменено: ${productName} ${item.quantity.toString()} → ${nextQuantity.toString()}`,
          oldValue: item.quantity.toString(),
          newValue: nextQuantity.toString(),
          reason: input.reason ?? null,
          performedById: ownerId,
        });
        newQuantity = nextQuantity;
      }
    }

    let newUnitPrice = item.unitPrice;
    if (input.unitPrice !== undefined) {
      const nextPrice = new Prisma.Decimal(input.unitPrice);
      if (!nextPrice.equals(item.unitPrice)) {
        logs.push({
          saleId,
          saleItemId: item.id,
          changeType: "PRICE_CHANGED",
          description: `Цена изменена: ${productName} ${money(item.unitPrice)} → ${money(nextPrice)}`,
          oldValue: money(item.unitPrice),
          newValue: money(nextPrice),
          reason: input.reason ?? null,
          performedById: ownerId,
        });
        newUnitPrice = nextPrice;
      }
    }

    if (logs.length === 0) return; // nothing actually changed — a no-op edit shouldn't log anything

    await tx.saleItem.update({
      where: { id: item.id },
      data: { quantity: newQuantity, unitPrice: newUnitPrice, subtotal: newUnitPrice.mul(newQuantity) },
    });

    await recomputeTotal(tx, saleId);
    await tx.saleChangeLog.createMany({ data: logs });
  });

  return getOwnerSaleDetail(locationId, saleId);
}

export async function addSaleItem(locationId: string, saleId: string, ownerId: string, input: AddSaleItemInput) {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id: saleId, locationId } });
    if (!sale) throw new AppError(404, "NOT_FOUND", "Продажа не найдена");
    if (sale.status !== "ACCEPTED") throw new AppError(409, "SALE_NOT_CORRECTABLE", "Исправления доступны только для оформленных продаж");

    const variant = await tx.productVariant.findUnique({ where: { id: input.variantId }, include: { product: true } });
    if (!variant) throw new AppError(404, "NOT_FOUND", "Товар не найден");
    if (!variant.isActive || !variant.product.isActive) {
      throw new AppError(422, "PRODUCT_INACTIVE", `«${variant.product.name}» больше недоступен для продажи`);
    }
    if (variant.product.saleType !== "WEIGHT" && !Number.isInteger(input.quantity)) {
      throw new AppError(422, "INVALID_QUANTITY", `«${variant.product.name}» продаётся только целым количеством`);
    }

    const subtotal = variant.price.mul(input.quantity);
    const newItem = await tx.saleItem.create({
      data: { saleId, variantId: variant.id, quantity: input.quantity, unitPrice: variant.price, subtotal },
    });

    await deductRecipeIngredients(tx, variant.id, locationId, input.quantity, ownerId, newItem.id);
    await recomputeTotal(tx, saleId);

    const label = `${variant.product.name} ×${input.quantity}`;
    await tx.saleChangeLog.create({
      data: {
        saleId,
        saleItemId: newItem.id,
        changeType: "ITEM_ADDED",
        description: `Добавлен товар: ${label}`,
        oldValue: null,
        newValue: label,
        reason: input.reason ?? null,
        performedById: ownerId,
      },
    });
  });

  return getOwnerSaleDetail(locationId, saleId);
}

export async function cancelSale(locationId: string, saleId: string, ownerId: string, input: CancelSaleInput) {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, locationId },
      include: { items: { where: { removedAt: null } } },
    });
    if (!sale) throw new AppError(404, "NOT_FOUND", "Продажа не найдена");
    if (sale.status !== "ACCEPTED") throw new AppError(409, "SALE_NOT_CORRECTABLE", "Отменить можно только оформленную продажу");

    // Put back everything still deducted — items already individually removed were already
    // restocked at removal time, so only the still-active lines need reversing here.
    for (const item of sale.items) {
      await restockRecipeIngredients(tx, item.variantId, locationId, Number(item.quantity), ownerId, item.id);
    }

    await tx.sale.update({
      where: { id: saleId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: ownerId, cancelReason: input.reason ?? null },
    });

    await tx.saleChangeLog.create({
      data: {
        saleId,
        saleItemId: null,
        changeType: "SALE_CANCELLED",
        description: "Чек полностью отменён",
        oldValue: "ACCEPTED",
        newValue: "CANCELLED",
        reason: input.reason ?? null,
        performedById: ownerId,
      },
    });
  });

  return getOwnerSaleDetail(locationId, saleId);
}
