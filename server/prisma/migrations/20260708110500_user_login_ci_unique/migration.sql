-- `User.login` already has a case-SENSITIVE unique constraint (`users_login_key`), but
-- user.service.ts's assertLoginAvailable checks case-insensitively (globally, not scoped to
-- isActive — a login must stay unique across every account ever created, active or not, since
-- it's an identity used throughout the audit trail). Without this, two concurrent
-- POST /api/users requests for "admin2" and "Admin2" could both pass the app-level check and
-- both satisfy the existing case-sensitive DB constraint, creating two logically-duplicate
-- accounts. Added alongside the existing constraint (not replacing it, unlike Category/
-- Ingredient) so the one `findUnique({where:{login}})` call in auth.service.ts's login() can
-- keep relying on `login` being a Prisma-recognized @unique field.
CREATE UNIQUE INDEX "users_login_lower_key" ON "users" (lower("login"));
