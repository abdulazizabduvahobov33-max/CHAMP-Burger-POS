import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/error.js";
import { isForeignKeyViolation, isUniqueViolation } from "../../shared/utils/prismaErrors.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./category.schema.js";

const DUPLICATE_NAME_MESSAGE = "Категория с таким названием уже существует";

export async function listCategories() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return categories.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products, createdAt: c.createdAt }));
}

async function assertNameAvailable(name: string, excludeId?: string) {
  const existing = await prisma.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) {
    throw new AppError(409, "DUPLICATE_NAME", DUPLICATE_NAME_MESSAGE);
  }
}

async function findCategoryOrThrow(id: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    throw new AppError(404, "NOT_FOUND", "Категория не найдена");
  }
  return category;
}

export async function createCategory(input: CreateCategoryInput) {
  await assertNameAvailable(input.name);
  try {
    const category = await prisma.category.create({ data: { name: input.name } });
    return { id: category.id, name: category.name, productCount: 0, createdAt: category.createdAt };
  } catch (error) {
    // Fallback for the race window between assertNameAvailable and this insert
    // (e.g. two requests creating differently-cased names at the same time).
    if (isUniqueViolation(error)) {
      throw new AppError(409, "DUPLICATE_NAME", DUPLICATE_NAME_MESSAGE);
    }
    throw error;
  }
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  await findCategoryOrThrow(id);
  await assertNameAvailable(input.name, id);
  try {
    const category = await prisma.category.update({
      where: { id },
      data: { name: input.name },
      include: { _count: { select: { products: true } } },
    });
    return { id: category.id, name: category.name, productCount: category._count.products, createdAt: category.createdAt };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "DUPLICATE_NAME", DUPLICATE_NAME_MESSAGE);
    }
    throw error;
  }
}

export async function deleteCategory(id: string) {
  await findCategoryOrThrow(id);
  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    throw new AppError(409, "CATEGORY_IN_USE", `Нельзя удалить: в категории ${productCount} товар(ов)`);
  }
  try {
    await prisma.category.delete({ where: { id } });
  } catch (error) {
    // Fallback for the race window between the count() check above and this delete
    // (a product could be assigned to this category in between).
    if (isForeignKeyViolation(error)) {
      throw new AppError(409, "CATEGORY_IN_USE", "Нельзя удалить: в категории появились товары");
    }
    throw error;
  }
}
