-- Reports (Module 7): composite index for the location+date-range scan every report query uses,
-- and a variantId index for the top-products GROUP BY. Additive only — no data changes.
CREATE INDEX "sales_locationId_createdAt_idx" ON "sales"("locationId", "createdAt");
CREATE INDEX "sale_items_variantId_idx" ON "sale_items"("variantId");
