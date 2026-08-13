import type { Role } from "@/shared/stores/authStore";

// Values are i18n keys (see entities/ingredient/model.ts's UNIT_LABELS for why). OWNER is listed
// for type-completeness only (Record<Role, string> must cover every Role value) — it never
// actually renders here, since the Users page (and the server behind it, see user.service.ts's
// listUsers) never surfaces an OWNER row at all.
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "user.role.SUPER_ADMIN",
  SELLER: "user.role.SELLER",
  OWNER: "user.role.OWNER",
};

// Deliberately excludes OWNER — matches user.schema.ts's ADMIN_MANAGED_ROLES server-side, so a
// SUPER_ADMIN can never even see it as a choice when creating/editing a user.
export const ROLE_OPTIONS: Role[] = ["SUPER_ADMIN", "SELLER"];

export type AppUser = {
  id: string;
  name: string;
  login: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
};

export type CreateUserInput = {
  name: string;
  login: string;
  password: string;
  role: Role;
};

export type UpdateUserInput = {
  name?: string;
  login?: string;
  role?: Role;
  isActive?: boolean;
};
