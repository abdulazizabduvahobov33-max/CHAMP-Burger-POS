-- AlterEnum: Unit (PIECE, GRAM, PORTION) -> (PIECE, KG, G, L, ML)
-- Ingredient table has no rows yet, but the mapping below keeps this safe even if it did.
BEGIN;
CREATE TYPE "Unit_new" AS ENUM ('PIECE', 'KG', 'G', 'L', 'ML');
ALTER TABLE "ingredients" ALTER COLUMN "unit" TYPE "Unit_new" USING (
  CASE "unit"::text
    WHEN 'GRAM' THEN 'G'
    WHEN 'PORTION' THEN 'PIECE'
    ELSE "unit"::text
  END
)::"Unit_new";
ALTER TYPE "Unit" RENAME TO "Unit_old";
ALTER TYPE "Unit_new" RENAME TO "Unit";
DROP TYPE "Unit_old";
COMMIT;

-- AlterTable
ALTER TABLE "ingredients" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN "note" TEXT;
