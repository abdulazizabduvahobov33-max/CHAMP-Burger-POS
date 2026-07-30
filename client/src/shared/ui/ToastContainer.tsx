import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useToastStore, type ToastType } from "@/shared/stores/toastStore";

const ICON_BY_TYPE: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const COLOR_BY_TYPE: Record<ToastType, string> = {
  success: "border-success/40 text-success",
  error: "border-danger/40 text-danger-soft",
  info: "border-champ/40 text-champ",
};

/** App-wide toast stack — mounted once at the root (see App.tsx), fed via `toast.success(...)`
 * / `toast.error(...)` (shared/stores/toastStore.ts) from anywhere, no prop drilling. */
export function ToastContainer() {
  const { t } = useTranslation();
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:items-end">
      {toasts.map((toastItem) => {
        const Icon = ICON_BY_TYPE[toastItem.type];
        return (
          <div
            key={toastItem.id}
            role={toastItem.type === "error" ? "alert" : "status"}
            aria-live={toastItem.type === "error" ? "assertive" : "polite"}
            className={`pointer-events-auto flex w-full max-w-sm animate-scale-in items-start gap-3 rounded-xl border bg-ink-card p-3 shadow-card ${COLOR_BY_TYPE[toastItem.type]}`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <p className="flex-1 text-sm text-white/80">{toastItem.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toastItem.id)}
              aria-label={t("common.close")}
              className="shrink-0 rounded-lg p-1 text-white/40 transition hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
