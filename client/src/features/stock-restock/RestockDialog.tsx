import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { useRestockIngredient } from "@/entities/ingredient/api";
import { UNIT_LABELS, type Ingredient } from "@/entities/ingredient/model";
import { getErrorMessage } from "@/shared/lib/errors";
import { toast } from "@/shared/stores/toastStore";
import { Dialog } from "@/shared/ui/Dialog";

type RestockDialogProps = {
  open: boolean;
  onClose: () => void;
  ingredient: Ingredient | null;
};

// Quick-add presets a cashier can stack (click +5 then +1 → 6) instead of typing every restock
// by hand. PIECE-unit ingredients round to whole numbers; weight/volume units keep decimals.
const QUICK_AMOUNTS = [1, 2, 5, 10, 20];

export function RestockDialog({ open, onClose, ingredient }: RestockDialogProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const mutation = useRestockIngredient(ingredient?.id ?? "");
  const isWholeUnit = ingredient?.unit === "PIECE";

  useEffect(() => {
    if (!open) return;
    setQuantity("");
    setNote("");
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ingredient]);

  if (!ingredient) return null;

  function addQuickAmount(amount: number) {
    setQuantity((prev) => {
      const next = (Number(prev) || 0) + amount;
      // Avoid float artifacts like 0.30000000000000004 while still allowing decimals.
      return String(Math.round(next * 1000) / 1000);
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ingredient) return;
    const toastMessage = t("warehouse.restockToast", { name: ingredient.name, quantity, unit: t(UNIT_LABELS[ingredient.unit]) });
    mutation.mutate(
      { quantity: Number(quantity), note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(toastMessage);
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("warehouse.restockTitle", { name: ingredient.name })}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-white/50">
          {t("warehouse.currentQuantity")}: <span className="font-semibold text-white">{ingredient.quantity}</span>{" "}
          {t(UNIT_LABELS[ingredient.unit])}
        </p>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
            {t("warehouse.quantityWithUnit", { unit: t(UNIT_LABELS[ingredient.unit]) })}
          </span>
          <input
            type="number"
            min={isWholeUnit ? 1 : 0.001}
            step={isWholeUnit ? 1 : 0.001}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            autoFocus
            required
            className="input"
          />

          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => addQuickAmount(amount)}
                className="rounded-lg bg-ink-soft px-2.5 py-1.5 text-xs font-bold text-white/60 transition hover:bg-ink-line hover:text-white"
              >
                +{amount}
              </button>
            ))}
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
            {t("warehouse.commentOptional")}
          </span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="input" />
        </label>

        {mutation.isError && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
            {getErrorMessage(mutation.error, t("warehouse.restockFailed"))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-ink-line px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !quantity}
            className="rounded-xl bg-success px-5 py-2 text-sm font-bold text-onaccent transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? t("common.saving") : t("warehouse.restock")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
