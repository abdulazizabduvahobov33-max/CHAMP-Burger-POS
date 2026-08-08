import { useEffect, useMemo, useState } from "react";
import { Banknote, Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatPrice } from "@/entities/product/lib";
import { Dialog } from "@/shared/ui/Dialog";

type PaymentDialogProps = {
  open: boolean;
  onClose: () => void;
  total: number;
  isPending: boolean;
  error: string | null;
  onConfirm: (cashReceived: number) => void;
};

// Common banknote denominations in circulation — used to suggest realistic "round up to..."
// amounts instead of forcing the cashier to type an exact figure for every sale.
const ROUND_STEPS = [5000, 10000, 50000, 100000];

function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

export function PaymentDialog({ open, onClose, total, isPending, error, onConfirm }: PaymentDialogProps) {
  const { t } = useTranslation();
  const [receivedInput, setReceivedInput] = useState(String(total));

  // Re-seed the input to the exact total each time the dialog opens for a new sale — otherwise
  // a leftover value from a previous (possibly cancelled) checkout would carry over.
  useEffect(() => {
    if (open) setReceivedInput(String(total));
  }, [open, total]);

  const received = Number(receivedInput) || 0;
  const change = received - total;
  const isSufficient = received >= total;

  const quickAmounts = useMemo(() => {
    const amounts = new Set<number>([total]);
    for (const step of ROUND_STEPS) {
      const rounded = roundUpTo(total, step);
      if (rounded > total) amounts.add(rounded);
    }
    return [...amounts].sort((a, b) => a - b).slice(0, 4);
  }, [total]);

  function handleSubmit() {
    if (!isSufficient || isPending) return;
    onConfirm(received);
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("pos.payment.title")} widthClassName="max-w-sm">
      <div className="space-y-5">
        <div className="rounded-xl bg-ink-soft p-4 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-white/40">{t("pos.payment.due")}</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-champ">{formatPrice(String(total))}</p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
            {t("pos.payment.received")}
          </label>
          <div className="relative">
            <Banknote className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={receivedInput}
              onChange={(e) => setReceivedInput(e.target.value)}
              autoFocus
              onFocus={(e) => e.target.select()}
              className="input pl-10 text-lg font-bold"
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setReceivedInput(String(amount))}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  received === amount
                    ? "bg-champ text-onaccent"
                    : "bg-ink-soft text-white/60 hover:bg-ink-line hover:text-white"
                }`}
              >
                {formatPrice(String(amount))}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
            isSufficient ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"
          }`}
        >
          <span className="text-sm font-medium text-white/70">{t("pos.payment.change")}</span>
          <span className={`text-xl font-extrabold tracking-tight ${isSufficient ? "text-success" : "text-danger-soft"}`}>
            {isSufficient ? formatPrice(String(change)) : t("pos.payment.insufficient")}
          </span>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isSufficient || isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-champ py-4 text-base font-bold text-onaccent shadow-card transition hover:bg-champ-hover hover:shadow-glow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
          {isPending ? t("pos.payment.processing") : t("pos.payment.confirm")}
        </button>
      </div>
    </Dialog>
  );
}
