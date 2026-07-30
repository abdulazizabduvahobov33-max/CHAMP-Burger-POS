-- Category names must be unique case-insensitively (the app already checks this way,
-- but the plain unique index only caught exact-case duplicates under concurrent requests).
DROP INDEX "categories_name_key";
CREATE UNIQUE INDEX "categories_name_lower_key" ON "categories" (lower("name"));
