export type AiMessageRole = "user" | "assistant";

export type AiMessage = {
  id: string;
  role: AiMessageRole;
  content: string;
  createdAt: string;
};
