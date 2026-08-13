-- CreateEnum
CREATE TYPE "SaleChangeType" AS ENUM ('ITEM_REMOVED', 'ITEM_ADDED', 'QUANTITY_CHANGED', 'PRICE_CHANGED', 'SALE_CANCELLED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'OWNER';

-- AlterEnum
ALTER TYPE "SaleStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "removeReason" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedById" TEXT;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT;

-- CreateTable
CREATE TABLE "sale_change_logs" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "saleItemId" TEXT,
    "changeType" "SaleChangeType" NOT NULL,
    "description" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_change_logs_saleId_performedAt_idx" ON "sale_change_logs"("saleId", "performedAt");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_change_logs" ADD CONSTRAINT "sale_change_logs_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_change_logs" ADD CONSTRAINT "sale_change_logs_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
