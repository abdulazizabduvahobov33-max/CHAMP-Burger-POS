import type { Prisma, Product, ProductVariant, Category } from "@prisma/client";

import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/error.js";
import { isForeignKeyViolation } from "../../shared/utils/prismaErrors.js";
import { deleteUploadedFile } from "../../shared/utils/uploads.js";
import type { CreateProductInput, ListProductsQuery, UpdateProductInput } from "./product.schema.js";

type ProductWithRelations = Product & { category: Category; variants: ProductVariant[] };

function serializeProduct(product: ProductWithRelations) {
  return {
    id: product.id,
    name: product.name,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    imageUrl: product.imageUrl,
    saleType: product.saleType,
    isActive: product.isActive,
    createdAt: product.createdAt,
    variants: product.variants
      .slice()
      .sort((a, b) => a.price.comparedTo(b.price))
      .map((v) => ({ id: v.id, label: v.label, price: v.price.toString() })),
  };
}

const include = { category: true, variants: true } satisfies Prisma.ProductInclude;

async function assertCategoryExists(categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw new AppError(422, "INVALID_CATEGORY", "Категория не найдена");
  }
}

export async function listProducts(query: ListProductsQuery) {
  const where: Prisma.ProductWhereInput = {
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.saleType ? { saleType: query.saleType } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include,
      orderBy: { name: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: products.map(serializeProduct),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function findProductOrThrow(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include });
  if (!product) {
    throw new AppError(404, "NOT_FOUND", "Товар не найден");
  }
  return product;
}

export async function getProduct(id: string) {
  return serializeProduct(await findProductOrThrow(id));
}

export async function createProduct(input: CreateProductInput) {
  await assertCategoryExists(input.categoryId);

  const product = await prisma.product.create({
    data: {
      name: input.name,
      categoryId: input.categoryId,
      saleType: input.saleType,
      imageUrl: input.imageUrl ?? null,
      variants: { create: input.variants.map((v) => ({ label: v.label, price: v.price })) },
    },
    include,
  });

  return serializeProduct(product);
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const existing = await findProductOrThrow(id);

  if (input.categoryId) {
    await assertCategoryExists(input.categoryId);
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (input.variants) {
        // Diff by id instead of delete-everything-and-recreate: a plain re-submit of the
        // existing variant list (e.g. editing the product's name, or tweaking one price) must
        // NOT hand out fresh variant ids for rows that already exist — Recipe.variantId cascades
        // on delete, so recreating a variant silently wipes its BOM, and any variant that has
        // ever been sold can't even be recreated (SaleItem.variantId restricts the delete).
        const existingIds = new Set(existing.variants.map((v) => v.id));
        const keptIds = new Set(input.variants.map((v) => v.id).filter((vid): vid is string => Boolean(vid)));
        const idsToRemove = [...existingIds].filter((vid) => !keptIds.has(vid));

        if (idsToRemove.length > 0) {
          await tx.productVariant.deleteMany({ where: { id: { in: idsToRemove } } });
        }

        for (const v of input.variants) {
          if (v.id && existingIds.has(v.id)) {
            await tx.productVariant.update({ where: { id: v.id }, data: { label: v.label, price: v.price } });
          } else {
            await tx.productVariant.create({ data: { productId: id, label: v.label, price: v.price } });
          }
        }
      }

      await tx.product.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.saleType !== undefined ? { saleType: input.saleType } : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    });
  } catch (error) {
    // A removed variant that has sale history can't be deleted (SaleItem.variantId restricts
    // it) — same conflict deleteProduct already converts to a clean 409 below.
    if (isForeignKeyViolation(error)) {
      throw new AppError(409, "VARIANT_IN_USE", "Нельзя удалить вариант: он используется в продажах");
    }
    throw error;
  }

  if (input.imageUrl !== undefined && existing.imageUrl && existing.imageUrl !== input.imageUrl) {
    void deleteUploadedFile(existing.imageUrl);
  }

  return getProduct(id);
}

export async function deleteProduct(id: string) {
  const existing = await findProductOrThrow(id);
  try {
    await prisma.product.delete({ where: { id } });
  } catch (error) {
    // A variant's sale history (SaleItem) doesn't cascade on delete by design —
    // once the POS module exists, this turns a raw constraint error into a clean 409.
    if (isForeignKeyViolation(error)) {
      throw new AppError(409, "PRODUCT_IN_USE", "Нельзя удалить: товар используется в продажах");
    }
    throw error;
  }
  void deleteUploadedFile(existing.imageUrl);
}
