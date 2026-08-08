import { useEffect, useRef, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { MessageCircle, Send, Sparkles, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAiMessages, useClearAiHistory, useSendAiMessage } from "@/entities/ai/api";
import type { AiMessage } from "@/entities/ai/model";
import { getErrorMessage } from "@/shared/lib/errors";
import { dateFnsLocale } from "@/shared/lib/dateLocale";
import { toast } from "@/shared/stores/toastStore";
import { BrandMark } from "@/shared/ui/BrandMark";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Skeleton } from "@/shared/ui/Skeleton";

const SUGGESTION_KEYS = ["week", "topProducts", "lowStock", "expense"] as const;

export function AiChatWidget() {
  const { t } = useTranslation();
  const { data: messages, isLoading } = useAiMessages();
  const sendMutation = useSendAiMessage();
  const clearMutation = useClearAiHistory();
  const [input, setInput] = useState("");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isEmpty = !isLoading && (messages?.length ?? 0) === 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sendMutation.isPending]);

  function handleSend(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(trimmed, {
      onError: (err) => toast.error(getErrorMessage(err, t("ai.sendFailed"))),
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-card bg-ink-card shadow-card">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-line p-4 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandMark size={32} />
          <div>
            <p className="text-sm font-bold text-white">{t("ai.assistantName")}</p>
            <span className="inline-flex items-center gap-1 text-xs text-champ">
              <Sparkles className="h-3 w-3" />
              {t("ai.localModeBadge")}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmClearOpen(true)}
          disabled={!messages || messages.length === 0}
          className="flex items-center gap-1.5 rounded-xl border border-ink-line px-3 py-2 text-xs font-medium text-white/60 transition hover:border-danger/40 hover:text-danger-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("ai.clearHistory")}</span>
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 sm:px-6">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-12 w-2/3 rounded-2xl" />
            <Skeleton className="ml-auto h-9 w-1/2 rounded-2xl" />
            <Skeleton className="h-16 w-3/4 rounded-2xl" />
          </div>
        )}

        {isEmpty && (
          <div className="flex h-full flex-col items-center justify-center">
            <EmptyState icon={MessageCircle} title={t("ai.emptyTitle")} description={t("ai.emptyDescription")} compact />
            <div className="mt-2 flex w-full max-w-md flex-wrap justify-center gap-2">
              {SUGGESTION_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setInput(t(`ai.suggestions.${key}`))}
                  className="rounded-full border border-ink-line bg-ink-soft px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-champ/40 hover:text-white"
                >
                  {t(`ai.suggestions.${key}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isLoading && (messages?.length ?? 0) > 0 && (
          <div className="space-y-4">
            {messages!.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {sendMutation.isPending && <TypingIndicator />}
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex shrink-0 items-end gap-2 border-t border-ink-line p-3 sm:px-6 sm:py-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t("ai.inputPlaceholder")}
          aria-label={t("ai.inputAriaLabel")}
          rows={1}
          maxLength={1000}
          className="input max-h-32 min-h-[42px] flex-1 resize-none py-2.5"
        />
        <button
          type="submit"
          disabled={!input.trim() || sendMutation.isPending}
          aria-label={t("ai.send")}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-champ text-onaccent shadow-card transition hover:bg-champ-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      <ConfirmDialog
        open={confirmClearOpen}
        title={t("ai.clearHistoryConfirmTitle")}
        description={t("ai.clearHistoryConfirmDescription")}
        confirmLabel={t("ai.clearHistory")}
        danger
        pending={clearMutation.isPending}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={() => {
          clearMutation.mutate(undefined, {
            onSuccess: () => {
              toast.success(t("ai.clearHistorySuccess"));
              setConfirmClearOpen(false);
            },
            onError: (err) => {
              toast.error(getErrorMessage(err, t("ai.clearHistoryFailed")));
              setConfirmClearOpen(false);
            },
          });
        }}
      />
    </div>
  );
}

function MessageBubble({ message }: { message: AiMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex animate-fade-in items-end gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && <BrandMark size={26} className="mb-5 shrink-0" />}
      <div className={`flex max-w-[85%] flex-col sm:max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser ? "rounded-br-md bg-champ text-onaccent" : "rounded-bl-md bg-ink-soft text-white"
          }`}
        >
          {message.content}
        </div>
        <span className="mt-1 px-1 text-[11px] text-white/30">{format(new Date(message.createdAt), "HH:mm", { locale: dateFnsLocale() })}</span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  const { t } = useTranslation();
  return (
    <div className="flex animate-fade-in items-end gap-2.5">
      <BrandMark size={26} className="mb-1 shrink-0" />
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-ink-soft px-4 py-3">
        <span className="sr-only">{t("ai.thinking")}</span>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40" />
      </div>
    </div>
  );
}
