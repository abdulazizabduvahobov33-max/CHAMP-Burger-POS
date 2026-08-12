import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/error.js";
import { isForeignKeyViolation, isUniqueViolation } from "../../shared/utils/prismaErrors.js";
import type { CreateTableInput, UpdateTableInput } from "./table.schema.js";

const DUPLICATE_NUMBER_MESSAGE = "Стол с таким номером уже существует";

export async function listTables(locationId: string) {
  const tables = await prisma.table.findMany({
    where: { locationId },
    orderBy: { number: "asc" },
  });
  return tables;
}

async function assertNumberAvailable(locationId: string, number: number, excludeId?: string) {
  const existing = await prisma.table.findFirst({
    where: { locationId, number, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) {
    throw new AppError(409, "DUPLICATE_NUMBER", DUPLICATE_NUMBER_MESSAGE);
  }
}

async function findTableOrThrow(locationId: string, id: string) {
  const table = await prisma.table.findFirst({ where: { id, locationId } });
  if (!table) {
    throw new AppError(404, "NOT_FOUND", "Стол не найден");
  }
  return table;
}

async function nextAvailableNumber(locationId: string): Promise<number> {
  const highest = await prisma.table.findFirst({
    where: { locationId },
    orderBy: { number: "desc" },
  });
  return (highest?.number ?? 0) + 1;
}

export async function createTable(locationId: string, input: CreateTableInput) {
  const number = input.number ?? (await nextAvailableNumber(locationId));
  if (input.number !== undefined) {
    await assertNumberAvailable(locationId, number);
  }
  try {
    return await prisma.table.create({ data: { locationId, number } });
  } catch (error) {
    // Fallback for the race window between the availability check (or the max-number read) and
    // this insert — two admins clicking "Добавить стол" at the same instant, say.
    if (isUniqueViolation(error)) {
      throw new AppError(409, "DUPLICATE_NUMBER", DUPLICATE_NUMBER_MESSAGE);
    }
    throw error;
  }
}

export async function updateTable(locationId: string, id: string, input: UpdateTableInput) {
  await findTableOrThrow(locationId, id);
  if (input.number !== undefined) {
    await assertNumberAvailable(locationId, input.number, id);
  }
  try {
    return await prisma.table.update({
      where: { id },
      data: { ...(input.number !== undefined ? { number: input.number } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "DUPLICATE_NUMBER", DUPLICATE_NUMBER_MESSAGE);
    }
    throw error;
  }
}

export async function deleteTable(locationId: string, id: string) {
  await findTableOrThrow(locationId, id);
  const saleCount = await prisma.sale.count({ where: { tableId: id } });
  if (saleCount > 0) {
    throw new AppError(409, "TABLE_IN_USE", `Нельзя удалить: за этим столом есть история заказов (${saleCount})`);
  }
  try {
    await prisma.table.delete({ where: { id } });
  } catch (error) {
    // Fallback for the race window between the count() check above and this delete
    // (an order could be placed at this table in between).
    if (isForeignKeyViolation(error)) {
      throw new AppError(409, "TABLE_IN_USE", "Нельзя удалить: за этим столом появились заказы");
    }
    throw error;
  }
}
