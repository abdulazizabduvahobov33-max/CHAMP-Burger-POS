-- Additive only: three new nullable/defaulted columns on sale_items. No existing column is
-- touched, no data is rewritten, no old row's meaning changes. Every existing row gets
-- unitCostSnapshot/costSnapshot = NULL (no snapshot exists for it) and hasCostSnapshot = false
-- (its default) — exactly the "historical cost unknown for this legacy row" state the
-- application code is written to expect and must never silently backfill.
ALTER TABLE "sale_items" ADD COLUMN "unitCostSnapshot" DECIMAL(12,2);
ALTER TABLE "sale_items" ADD COLUMN "costSnapshot" DECIMAL(14,2);
ALTER TABLE "sale_items" ADD COLUMN "hasCostSnapshot" BOOLEAN NOT NULL DEFAULT false;
