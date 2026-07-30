-- CreateIndex
CREATE INDEX "purchase_items_ingredientId_idx" ON "purchase_items"("ingredientId");

-- CreateIndex
CREATE INDEX "purchases_locationId_purchaseDate_idx" ON "purchases"("locationId", "purchaseDate");
