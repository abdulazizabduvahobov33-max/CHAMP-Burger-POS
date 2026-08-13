import { Prisma } from "@prisma/client";

import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/error.js";
import { newNotificationId, notificationBus } from "../../shared/notifications/notificationBus.js";
import { shortReceiptNumber } from "../../shared/utils/receiptNumber.js";
import { deductRecipeIngredients } from "../recipes/recipe.service.js";
import type { SaleItemInput } from "./sale.schema.js";

type SaleWithItems = Prisma.SaleGetPayload<{
  include: { items: { include: { variant: { include: { product: true } } } }; table: true };
}>;

function serializeSale(sale: SaleWithItems) {
  return {
    id: sale.id,
    receiptNumber: shortReceiptNumber(sale.id),
    tableNumber: sale.table?.number ?? null,
    totalAmount: sale.totalAmount.toString(),
    cashReceived: sale.cashReceived?.toString() ?? null,
    changeGiven: sale.changeGiven?.toString() ?? null,
    status: sale.status,
    acceptedAt: sale.acceptedAt,
    createdAt: sale.createdAt,
    items: sale.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      productName: item.variant.product.name,
      variantLabel: item.variant.label,
      saleType: item.variant.product.saleType,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      subtotal: item.subtotal.toString(),
    })),
  };
}

export async function getSale(id: string) {
  const sale = await prisma.sale.findUniqueOrThrow({
    where: { id },
    // removedAt: null — a seller's own receipt view reflects current, owner-corrected state,
    // not the raw correction history (that's the owner panel's job — see owner.service.ts).
    include: { items: { where: { removedAt: null }, include: { variant: { include: { product: true } } } }, table: true },
  });
  return serializeSale(sale);
}

/**
 * The seller's own order history — always scoped to the calling user's id, regardless of role,
 * so "my sales" means exactly that for anyone hitting these two endpoints. Admin-wide sales
 * analysis across every seller stays under /api/reports (Module 7), a separate concern.
 */
export async function listMySales(sellerId: string, page: number, pageSize: number) {
  const where: Prisma.SaleWhereInput = { sellerId };

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        totalAmount: true,
        cashReceived: true,
        changeGiven: true,
        status: true,
        table: { select: { number: true } },
        _count: { select: { items: { where: { removedAt: null } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sale.count({ where }),
  ]);

  return {
    items: sales.map((s) => ({
      id: s.id,
      receiptNumber: shortReceiptNumber(s.id),
      tableNumber: s.table?.number ?? null,
      createdAt: s.createdAt,
      totalAmount: s.totalAmount.toString(),
      cashReceived: s.cashReceived?.toString() ?? null,
      changeGiven: s.changeGiven?.toString() ?? null,
      status: s.status,
      itemCount: s._count.items,
    })),
    page,
    pageSize,
    total,
  };
}

export async function getMySale(id: string, sellerId: string) {
  const sale = await prisma.sale.findUniqueOrThrow({
    where: { id },
    include: { items: { where: { removedAt: null }, include: { variant: { include: { product: true } } } }, table: true },
  });
  if (sale.sellerId !== sellerId) {
    // Same 404 as "doesn't exist" (not 403) — a seller has no business learning that a given
    // id belongs to someone else's sale.
    throw new AppError(404, "NOT_FOUND", "Продажа не найдена");
  }
  return serializeSale(sale);
}

/**
 * Creates a Sale + its SaleItems in ONE transaction. Prices are always looked up server-side
 * from the variant's current price — the client only ever sends variantId + quantity, never a
 * price. The variant lookup (existence, active state, price) happens INSIDE the transaction
 * rather than as a pre-check — otherwise a concurrent price change or product deactivation
 * landing in the gap between a pre-check and the transaction opening would silently go
 * unnoticed, charging a stale price or selling a now-unavailable item.
 *
 * `autoAccept` decides whether this is a register sale (SUPER_ADMIN, "Принять заказ" rings it up
 * immediately) or a sent order (SELLER/waiter, "Отправить заказ" — a SUPER_ADMIN reviews and
 * accepts it later via acceptSale). It comes from the caller's ROLE, decided in the controller —
 * never a client-supplied flag, so a seller's own request can't mark itself pre-accepted.
 * When true, this does everything acceptSale would do (deduct recipe ingredients, capture
 * payment) in the same transaction instead of a second round trip — one atomic write for the
 * common "ring it up right now" case. When false, stock is left untouched and payment fields
 * stay null until acceptSale runs — a sale that's only ever sent, never accepted, must have
 * zero effect on stock or reporting (see report.service.ts / report.costing.ts's `status:
 * "ACCEPTED"` filters).
 */
export async function createSale(
  locationId: string,
  sellerId: string,
  items: SaleItemInput[],
  cashReceived: number | undefined,
  autoAccept: boolean,
  tableId?: string,
) {
  // A waiter's order must always be tied to a table — the whole point of the table system is
  // knowing where an order came from — but a register (admin, autoAccept) sale isn't necessarily
  // seated at anything, so this is only enforced for the non-autoAccept (SELLER) path.
  if (!autoAccept && !tableId) {
    throw new AppError(422, "TABLE_REQUIRED", "Выберите стол перед отправкой заказа");
  }

  // Defensive: collapse accidental duplicate variantId entries in one request instead of
  // trusting the client to have already aggregated quantities per line.
  const merged = new Map<string, number>();
  for (const item of items) {
    merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity);
  }
  const variantIds = [...merged.keys()];

  const saleId = await prisma.$transaction(async (tx) => {
    if (tableId) {
      const table = await tx.table.findFirst({ where: { id: tableId, locationId } });
      if (!table) {
        throw new AppError(404, "NOT_FOUND", "Стол не найден");
      }
      if (!table.isActive) {
        throw new AppError(422, "TABLE_INACTIVE", "Этот стол отключён");
      }
    }

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

    const sale = await tx.sale.create({
      data: { sellerId, locationId, tableId, totalAmount: 0, status: autoAccept ? "ACCEPTED" : "PENDING" },
    });

    let totalAmount = new Prisma.Decimal(0);
    for (const [variantId, quantity] of merged) {
      const variant = variantMap.get(variantId)!;
      const unitPrice = variant.price;
      const subtotal = unitPrice.mul(quantity);
      totalAmount = totalAmount.add(subtotal);

      const saleItem = await tx.saleItem.create({
        data: { saleId: sale.id, variantId, quantity, unitPrice, subtotal },
      });

      if (autoAccept) {
        // Same recipe-deduction primitive Module 5 built and race-tested, now composed into
        // this larger transaction instead of opening its own — see recipe.service.ts. A
        // not-yet-accepted (PENDING) sale skips this entirely — nothing is deducted until
        // someone actually accepts it.
        await deductRecipeIngredients(tx, variantId, locationId, quantity, sellerId, saleItem.id);
      }
    }

    let changeGiven: Prisma.Decimal | undefined;
    if (autoAccept) {
      // Validated against the server-computed total (never the client's pre-checkout snapshot) —
      // the same reasoning as looking up prices fresh inside the transaction above.
      if (cashReceived !== undefined) {
        const received = new Prisma.Decimal(cashReceived);
        if (received.lt(totalAmount)) {
          throw new AppError(422, "INSUFFICIENT_PAYMENT", "Полученная сумма меньше суммы заказа");
        }
        changeGiven = received.sub(totalAmount);
      }
    }

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        totalAmount,
        ...(autoAccept
          ? {
              acceptedAt: new Date(),
              cashReceived: cashReceived !== undefined ? new Prisma.Decimal(cashReceived) : undefined,
              changeGiven,
            }
          : {}),
      },
    });
    return sale.id;
  });

  const sale = await getSale(saleId);

  if (!autoAccept) {
    // Fire-and-forget: this is a best-effort real-time nudge, not part of the sale's own
    // correctness — if nobody's connected right now, the order still sits in listPendingSales()
    // for the admin to find on their next visit either way. See notificationBus.ts.
    const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { name: true } });
    notificationBus.publish(locationId, {
      id: newNotificationId(),
      type: "order.new",
      title: "Новый заказ",
      message: `${seller?.name ?? "Официант"} — ${sale.items.length} поз. на ${sale.totalAmount}`,
      createdAt: new Date().toISOString(),
      roles: ["SUPER_ADMIN"],
      data: {
        saleId: sale.id,
        sellerId,
        sellerName: seller?.name ?? null,
        tableNumber: sale.tableNumber,
        receiptNumber: sale.receiptNumber,
        totalAmount: sale.totalAmount,
        itemCount: sale.items.length,
      },
    });
  }

  return sale;
}

/**
 * Admin-only: confirms a PENDING sale a seller sent in — deducts every item's recipe
 * ingredients (nothing was touched at creation time), captures payment, and marks it ACCEPTED.
 * Same all-or-nothing transaction shape as the autoAccept branch of createSale above; if any
 * ingredient runs short between "sent" and "accepted", the whole accept is rolled back and the
 * sale stays PENDING for the admin to retry or reject.
 */
export async function acceptSale(locationId: string, id: string, cashReceived?: number) {
  const sellerId = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id, locationId }, include: { items: true } });
    if (!sale) {
      throw new AppError(404, "NOT_FOUND", "Продажа не найдена");
    }
    // Not just `=== "ACCEPTED"` — a REJECTED sale must be just as immovable as an already-
    // ACCEPTED one, or a stale "Принять заказ" click (e.g. two admins working the same queue)
    // could resurrect an order the cashier already declined.
    if (sale.status !== "PENDING") {
      throw new AppError(409, "ALREADY_HANDLED", "Заказ уже обработан");
    }

    for (const item of sale.items) {
      await deductRecipeIngredients(tx, item.variantId, locationId, Number(item.quantity), sale.sellerId, item.id);
    }

    let changeGiven: Prisma.Decimal | undefined;
    if (cashReceived !== undefined) {
      const received = new Prisma.Decimal(cashReceived);
      if (received.lt(sale.totalAmount)) {
        throw new AppError(422, "INSUFFICIENT_PAYMENT", "Полученная сумма меньше суммы заказа");
      }
      changeGiven = received.sub(sale.totalAmount);
    }

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        cashReceived: cashReceived !== undefined ? new Prisma.Decimal(cashReceived) : undefined,
        changeGiven,
      },
    });

    return sale.sellerId;
  });

  const sale = await getSale(id);
  notificationBus.publish(locationId, {
    id: newNotificationId(),
    type: "order.accepted",
    title: "Заказ принят",
    message: `Заказ №${sale.receiptNumber} принят`,
    createdAt: new Date().toISOString(),
    // SELLER so the waiter who sent it finds out; SUPER_ADMIN too — a second admin tab/device
    // has no other way to know this order just left the pending queue, now that the queue no
    // longer polls (see usePendingSales()'s comment on why polling was removed).
    roles: ["SELLER", "SUPER_ADMIN"],
    data: { saleId: sale.id, sellerId, receiptNumber: sale.receiptNumber },
  });

  return sale;
}

/**
 * Admin-only: declines a PENDING sale instead of accepting it. Nothing was ever touched at
 * creation time (stock, payment) for a PENDING sale — so unlike acceptSale, there's nothing to
 * roll back or compensate, just a status flip. The seller who sent it gets notified so they know
 * to follow up with the customer rather than assuming it's quietly on its way.
 */
export async function rejectSale(locationId: string, id: string) {
  const sellerId = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id, locationId } });
    if (!sale) {
      throw new AppError(404, "NOT_FOUND", "Продажа не найдена");
    }
    if (sale.status !== "PENDING") {
      throw new AppError(409, "ALREADY_HANDLED", "Заказ уже обработан");
    }

    await tx.sale.update({ where: { id: sale.id }, data: { status: "REJECTED" } });
    return sale.sellerId;
  });

  const sale = await getSale(id);
  notificationBus.publish(locationId, {
    id: newNotificationId(),
    type: "order.rejected",
    title: "Заказ отклонён",
    message: `Заказ №${sale.receiptNumber} отклонён`,
    createdAt: new Date().toISOString(),
    roles: ["SELLER", "SUPER_ADMIN"],
    data: { saleId: sale.id, sellerId, receiptNumber: sale.receiptNumber },
  });

  return sale;
}

/**
 * The admin "new orders" queue — every seller's PENDING sale at this location, oldest first
 * (first come, first served, like a real order queue). Deliberately not paginated: this is a
 * short-lived working list (an order that never gets accepted is an anomaly worth surfacing in
 * full, not truncating), unlike listSales'/listMySales' historical, paginated views.
 */
export async function listPendingSales(locationId: string) {
  const sales = await prisma.sale.findMany({
    where: { locationId, status: "PENDING" },
    include: {
      seller: { select: { name: true } },
      table: true,
      items: { include: { variant: { include: { product: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return sales.map((sale) => ({
    id: sale.id,
    receiptNumber: shortReceiptNumber(sale.id),
    tableNumber: sale.table?.number ?? null,
    sellerName: sale.seller.name,
    totalAmount: sale.totalAmount.toString(),
    createdAt: sale.createdAt,
    items: sale.items.map((item) => ({
      id: item.id,
      productName: item.variant.product.name,
      variantLabel: item.variant.label,
      saleType: item.variant.product.saleType,
      quantity: item.quantity.toString(),
      subtotal: item.subtotal.toString(),
    })),
  }));
}
