import { AiMessageRole } from "@prisma/client";

import { prisma } from "../../config/db.js";
import { getAIProvider } from "./providers/index.js";
import type { SendMessageInput } from "./ai.schema.js";

const HISTORY_LIMIT = 200;

function serializeMessage(message: { id: string; role: AiMessageRole; content: string; createdAt: Date }) {
  return {
    id: message.id,
    role: message.role === AiMessageRole.USER ? ("user" as const) : ("assistant" as const),
    content: message.content,
    createdAt: message.createdAt,
  };
}

export async function listMessages(userId: string) {
  const messages = await prisma.aiMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: HISTORY_LIMIT,
  });
  return messages.map(serializeMessage);
}

/** Persists the user's message immediately, then the assistant's reply — a provider failure
 * (network error from a future real LLM, etc.) still leaves the conversation in a consistent
 * state and always produces a visible reply instead of leaving the chat hanging. */
export async function sendMessage(userId: string, locationId: string, input: SendMessageInput) {
  const userMessage = await prisma.aiMessage.create({
    data: { userId, locationId, role: AiMessageRole.USER, content: input.message },
  });

  const provider = getAIProvider();
  let replyText: string;
  try {
    const reply = await provider.generateResponse(input.message, { userId, locationId });
    replyText = reply.text;
  } catch {
    replyText = "Извините, не получилось обработать сообщение. Попробуйте ещё раз.";
  }

  const assistantMessage = await prisma.aiMessage.create({
    data: { userId, locationId, role: AiMessageRole.ASSISTANT, content: replyText },
  });

  return { userMessage: serializeMessage(userMessage), assistantMessage: serializeMessage(assistantMessage) };
}

export async function clearHistory(userId: string) {
  const result = await prisma.aiMessage.deleteMany({ where: { userId } });
  return { deleted: result.count };
}
