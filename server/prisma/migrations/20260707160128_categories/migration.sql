-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- Backfill: one Category row per distinct existing products.category string
INSERT INTO "categories" ("id", "name")
SELECT gen_random_uuid()::text, sub."category"
FROM (SELECT DISTINCT "category" FROM "products") AS sub;

-- AlterTable: add categoryId, backfill from the new categories table, then drop the old column
ALTER TABLE "products" ADD COLUMN "categoryId" TEXT;

UPDATE "products" p
SET "categoryId" = c."id"
FROM "categories" c
WHERE c."name" = p."category";

ALTER TABLE "products" ALTER COLUMN "categoryId" SET NOT NULL;

DROP INDEX "products_category_idx";
ALTER TABLE "products" DROP COLUMN "category";

CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
