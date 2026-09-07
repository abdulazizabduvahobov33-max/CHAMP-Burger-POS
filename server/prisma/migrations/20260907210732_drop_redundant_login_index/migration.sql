-- Drops a fully redundant index. `users.login` already has a UNIQUE constraint
-- (users_login_key), which Postgres implements as its own btree index on this exact column —
-- users_login_idx (from the old `@@index([login])`) indexed the identical column a second time,
-- providing the query planner nothing it couldn't already do with the unique index, while still
-- costing storage and write-time maintenance on every INSERT/UPDATE. Confirmed via pg_indexes
-- before writing this migration. Safe/backward-compatible: DROP INDEX never touches data, and
-- login lookups/uniqueness enforcement are entirely unaffected (users_login_key and the
-- case-insensitive users_login_lower_key both remain).
DROP INDEX IF EXISTS "users_login_idx";
