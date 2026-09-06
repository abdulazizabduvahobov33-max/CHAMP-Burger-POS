-- AlterTable
-- Additive, backward-compatible: nullable column, existing rows get NULL, and Postgres unique
-- indexes allow any number of NULLs (they only enforce uniqueness among non-NULL values), so no
-- existing row can conflict with another. Nothing is dropped, renamed, or made non-nullable.
ALTER TABLE "sales" ADD COLUMN     "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sales_clientRequestId_key" ON "sales"("clientRequestId");
