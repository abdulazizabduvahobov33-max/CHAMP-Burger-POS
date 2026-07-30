import { Role } from "@prisma/client";
import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(120),
  login: z.string().trim().min(3, "Минимум 3 символа").max(60),
  password: z.string().min(6, "Минимум 6 символов"),
  role: z.nativeEnum(Role, { errorMap: () => ({ message: "Некорректная роль" }) }),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(120).optional(),
  login: z.string().trim().min(3, "Минимум 3 символа").max(60).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
});

export const setPasswordSchema = z.object({
  password: z.string().min(6, "Минимум 6 символов"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
