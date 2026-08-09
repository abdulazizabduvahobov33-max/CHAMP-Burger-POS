-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "status" "SaleStatus" NOT NULL DEFAULT 'ACCEPTED';

-- CreateIndex
CREATE INDEX "sales_locationId_status_idx" ON "sales"("locationId", "status");
