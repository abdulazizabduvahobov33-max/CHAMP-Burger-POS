-- Ingredient names must be unique case-insensitively among ACTIVE ingredients (the app
-- already checks this way in ingredient.service.ts's assertNameAvailable, scoped to
-- isActive:true so a deactivated ingredient's old name can be reused) — but until now there
-- was no unique constraint at all, not even a case-sensitive one, so a race between two
-- concurrent POST /api/ingredients requests could create two active ingredients with the
-- same name. Partial + functional index, mirroring the fix already applied to Category in
-- 20260707185104_category_name_ci_unique (Prisma's schema DSL can't express a partial unique
-- index, so this exists only here, not as @@unique in schema.prisma).
CREATE UNIQUE INDEX "ingredients_name_lower_active_key" ON "ingredients" (lower("name")) WHERE "isActive" = true;
