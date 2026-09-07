import { AlertCircle, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";

type ErrorStateProps = {
  message: string;
  /** Omit only when the failure genuinely can't be retried (rare) — every recoverable read
   * error should let the user try again without reloading the whole page. */
  onRetry?: () => void;
  compact?: boolean;
};

/** Shared "this failed, here's what happened, try again" state for a query that errored — the
 * counterpart to EmptyState for the "recoverable error" case every async screen needs (see the
 * error/timeout/resilience audit). Not for validation errors inline in a form — this is for a
 * whole screen/section that failed to load. */
export function ErrorState({ message, onRetry, compact = false }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className={`flex animate-fade-in flex-col items-center justify-center text-center ${compact ? "px-6 py-10" : "px-6 py-16"}`}
    >
      <span
        className={`flex items-center justify-center rounded-2xl bg-danger/10 ${compact ? "h-12 w-12" : "h-16 w-16"}`}
      >
        <AlertCircle className={`text-danger-soft ${compact ? "h-6 w-6" : "h-7 w-7"}`} strokeWidth={1.75} />
      </span>
      <p className={`font-semibold text-white ${compact ? "mt-3 text-sm" : "mt-4 text-base"}`}>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 flex items-center gap-2 rounded-xl border border-ink-line px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-champ/50 hover:text-white"
        >
          <RotateCw className="h-4 w-4" />
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
