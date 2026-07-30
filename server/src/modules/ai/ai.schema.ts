import { z } from "zod";

export const sendMessageSchema = z.object({
  message: z.string().trim().min(1, "Введите сообщение").max(1000, "Сообщение слишком длинное"),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
