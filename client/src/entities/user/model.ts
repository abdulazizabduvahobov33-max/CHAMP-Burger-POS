import type { Role } from "@/shared/stores/authStore";

// Values are i18n keys (see entities/ingredient/model.ts's UNIT_LABELS for why).
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "user.role.SUPER_ADMIN",
  SELLER: "user.role.SELLER",
};

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
