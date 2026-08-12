import { z } from "zod";

// number is optional on create — the admin's "➕ Добавить стол" button creates a table with zero
// clicks (auto-assigned next number, see table.service.ts's createTable), but an explicit number
// is still accepted for cases like re-creating a specific deleted table number.
export const createTableSchema = z.object({
  number: z.number().int().positive("Номер стола должен быть положительным числом").optional(),
});

export const updateTableSchema = z.object({
  number: z.number().int().positive("Номер стола должен быть положительным числом").optional(),
  isActive: z.boolean().optional(),
});

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
