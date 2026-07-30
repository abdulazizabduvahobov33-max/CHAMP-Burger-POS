import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/error.js";
import type { CreateSupplierInput, UpdateSupplierInput } from "./supplier.schema.js";

function serializeSupplier(supplier: { id: string; name: string; phone: string | null; note: string | null; createdAt: Date }) {
  return { id: supplier.id, name: supplier.name, phone: supplier.phone, note: supplier.note, createdAt: supplier.createdAt };
}

export async function listSuppliers() {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return suppliers.map(serializeSupplier);
}

async function findSupplierOrThrow(id: string) {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) {
    throw new AppError(404, "NOT_FOUND", "Поставщик не найден");
  }
  return supplier;
}

export async function createSupplier(input: CreateSupplierInput) {
  const supplier = await prisma.supplier.create({ data: input });
  return serializeSupplier(supplier);
}

export async function updateSupplier(id: string, input: UpdateSupplierInput) {
  await findSupplierOrThrow(id);
  const supplier = await prisma.supplier.update({ where: { id }, data: input });
  return serializeSupplier(supplier);
}

export async function deleteSupplier(id: string) {
  await findSupplierOrThrow(id);
  // No in-use guard needed: Purchase.supplierId is ON DELETE SET NULL (schema.prisma) —
  // past purchases keep their line-item history, they just lose the supplier label.
  await prisma.supplier.delete({ where: { id } });
}
