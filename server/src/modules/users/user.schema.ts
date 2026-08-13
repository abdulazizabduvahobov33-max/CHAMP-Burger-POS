import { z } from "zod";

// Deliberately NOT Role (which also has OWNER) — the Users page is a SUPER_ADMIN-managed admin
// tool, and OWNER must never be creatable or assignable through it (or any API call that reuses
// this schema): that account only ever comes from bootstrap/ensureOwnerExists.ts, seeded from
// server-environment credentials nobody with only Users-page access controls. See
// user.service.ts for the matching runtime guard against a role: "OWNER" row ever surfacing here.
const ADMIN_MANAGED_ROLES = ["SUPER_ADMIN", "SELLER"] as const;

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(120),
  login: z.string().trim().min(3, "Минимум 3 символа").max(60),
  password: z.string().min(6, "Минимум 6 символов"),
  role: z.enum(ADMIN_MANAGED_ROLES, { errorMap: () => ({ message: "Некорректная роль" }) }),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(120).optional(),
  login: z.string().trim().min(3, "Минимум 3 символа").max(60).optional(),
  role: z.enum(ADMIN_MANAGED_ROLES).optional(),
  isActive: z.boolean().optional(),
});

export const setPasswordSchema = z.object({
  password: z.string().min(6, "Минимум 6 символов"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
