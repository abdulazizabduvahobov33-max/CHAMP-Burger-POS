import { Prisma } from "@prisma/client";

import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/error.js";
import { resolveDateRange } from "../../shared/utils/dateRange.js";
import type { CreatePurchaseInput, ListPurchasesQuery } from "./purchase.schema.js";

const ZERO = new Prisma.Decimal(0);

type PurchaseWithItems = Prisma.PurchaseGetPayload<{
  include: { supplier: true; createdBy: { select: { name: true } }; items: { include: { ingredient: true } } };
}>;

function serializePurchase(purchase: PurchaseWithItems) {
  return {
    id: purchase.id,
    supplierId: purchase.supplierId,
    supplierName: purchase.supplier?.name ?? null,
    purchaseDate: purchase.purchaseDate,
    totalCost: purchase.totalCost.toString(),
    note: purchase.note,
    createdByName: purchase.createdBy.name,
    items: purchase.items.map((item) => ({
      id: item.id,
      ingredientId: item.ingredientId,
      ingredientName: item.ingredient.name,
      unit: item.ingredient.unit,
      packQuantity: item.packQuantity.toString(),
      unitsPerPack: item.unitsPerPack.toString(),
      packPrice: item.packPrice.toString(),
      totalUnits: item.packQuantity.mul(item.unitsPerPack).toString(),
      unitCost: item.packPrice.div(item.unitsPerPack).toString(),
      lineTotal: item.packQuantity.mul(item.packPrice).toString(),
    })),
  };
}

const purchaseInclude = {
  supplier: true,
  createdBy: { select: { name: true } },
  items: { include: { ingredient: true } },
} satisfies Prisma.PurchaseInclude;

export async function getPurchase(locationId: string, id: string) {
  const purchase = await prisma.purchase.findFirst({ where: { id, locationId }, include: purchaseInclude });
  if (!purchase) {
    throw new AppError(404, "NOT_FOUND", "Закупка не найдена");
  }
  return serializePurchase(purchase);
}

/**
 * Records a purchase: creates the Purchase + its PurchaseItems, adds every item's units to
 * stock, logs a StockReason.PURCHASE movement per line, and updates each ingredient's cost
 * fields (lastUnitCost = this purchase's unit cost; avgUnitCost = a running weighted average
 * across all locations' stock) — all in ONE transaction, mirroring the Sale-creation shape
 * from Module 6 (one write path, all-or-nothing).
 *
 * Ingredients are validated fresh *inside* the transaction (existence + active state), same
 * reasoning as Module 6's variant lookup: a concurrent deactivation landing in the gap between
 * a pre-check and the transaction opening would otherwise go unnoticed.
 *
 * The avgUnitCost read-then-write here is NOT wrapped in the same race-proof `updateMany`
 * pattern used for stock deduction elsewhere — unlike checkout/write-off, purchases are a
 * low-frequency, single-admin data-entry action, not a highly concurrent hot path, so a
 * running-average cost figure drifting slightly under a genuine simultaneous double-entry is
 * an acceptable, documented tradeoff rather than a correctness bug (stock quantity itself,
 * the number that gates sales, is still updated via an atomic increment either way).
 */
export async function createPurchase(locationId: string, userId: string, input: CreatePurchaseInput) {
  if (input.supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) {
      throw new AppError(404, "NOT_FOUND", "Поставщик не найден");
    }
  }

  const purchaseId = await prisma.$transaction(async (tx) => {
    const ingredientIds = [...new Set(input.items.map((i) => i.ingredientId))];
    const ingredients = await tx.ingredient.findMany({ where: { id: { in: ingredientIds }, isActive: true } });
    const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));
    if (ingredientMap.size !== ingredientIds.length) {
      throw new AppError(422, "INVALID_INGREDIENT", "Один или несколько ингредиентов не найдены");
    }

    const purchase = await tx.purchase.create({
      data: { supplierId: input.supplierId, locationId, note: input.note, totalCost: 0, createdById: userId },
    });

    let totalCost = ZERO;

    for (const item of input.items) {
      const ingredient = ingredientMap.get(item.ingredientId)!;
      const totalUnits = new Prisma.Decimal(item.packQuantity).mul(item.unitsPerPack);
      const unitCost = new Prisma.Decimal(item.packPrice).div(item.unitsPerPack);
      const lineTotal = new Prisma.Decimal(item.packQuantity).mul(item.packPrice);
      totalCost = totalCost.add(lineTotal);

      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          ingredientId: item.ingredientId,
          packQuantity: item.packQuantity,
          unitsPerPack: item.unitsPerPack,
          packPrice: item.packPrice,
        },
      });

      const stock = await tx.stock.upsert({
        where: { ingredientId_locationId: { ingredientId: item.ingredientId, locationId } },
        create: { ingredientId: item.ingredientId, locationId, quantity: totalUnits },
        update: { quantity: { increment: totalUnits } },
      });
      // Same before/after bookkeeping as ingredient.service.ts's restock — the upsert's
      // returned row already reflects the increment, so deriving `before` from it is exact
      // regardless of which branch ran.
      const afterQty = stock.quantity;
      const beforeQty = afterQty.minus(totalUnits);

      await tx.stockMovement.create({
        data: {
          ingredientId: item.ingredientId,
          locationId,
          change: totalUnits,
          quantityBefore: beforeQty,
          quantityAfter: afterQty,
          reason: "PURCHASE",
          referenceId: purchase.id,
          createdById: userId,
        },
      });

      // Weighted average across all locations' existing stock for this ingredient, taken
      // BEFORE this purchase's units are added (see function doc for the race caveat).
      const stockAgg = await tx.stock.aggregate({ where: { ingredientId: item.ingredientId }, _sum: { quantity: true } });
      const qtyBefore = (stockAgg._sum.quantity ?? ZERO).sub(totalUnits);
      const newAvg = qtyBefore.lessThanOrEqualTo(0)
        ? unitCost
        : qtyBefore.mul(ingredient.avgUnitCost).add(totalUnits.mul(unitCost)).div(qtyBefore.add(totalUnits));

      await tx.ingredient.update({
        where: { id: item.ingredientId },
        data: { lastUnitCost: unitCost, avgUnitCost: newAvg },
      });

      // Keep the in-memory snapshot in sync — a purchase can list the same ingredient on more
      // than one line (e.g. a case plus a loose extra unit), and without this the second line's
      // weighted average would read the pre-transaction avgUnitCost, silently discarding what
      // the first line just wrote (and then overwrite it with that mis-weighted figure).
      ingredientMap.set(item.ingredientId, { ...ingredient, avgUnitCost: newAvg });
    }

    await tx.purchase.update({ where: { id: purchase.id }, data: { totalCost } });
    return purchase.id;
  });

  return getPurchase(locationId, purchaseId);
}

export async function listPurchases(locationId: string, query: ListPurchasesQuery) {
  const range = resolveDateRange(query.preset, query.from, query.to);

  const where: Prisma.PurchaseWhereInput = {
    locationId,
    purchaseDate: { gte: range.start, lte: range.end },
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.search
      ? {
          OR: [
            { supplier: { name: { contains: query.search, mode: "insensitive" } } },
            { note: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [purchases, total, summary] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: { supplier: true, _count: { select: { items: true } } },
      orderBy: { purchaseDate: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.purchase.count({ where }),
    prisma.purchase.aggregate({ where, _sum: { totalCost: true }, _count: { _all: true } }),
  ]);

  return {
    items: purchases.map((p) => ({
      id: p.id,
      supplierName: p.supplier?.name ?? null,
      purchaseDate: p.purchaseDate,
      totalCost: p.totalCost.toString(),
      note: p.note,
      itemCount: p._count.items,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    summary: {
      totalCost: (summary._sum.totalCost ?? ZERO).toString(),
      count: summary._count._all,
    },
  };
}
