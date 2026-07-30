import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { useWriteOffIngredient } from "@/entities/ingredient/api";
import { UNIT_LABELS, type Ingredient } from "@/entities/ingredient/model";
import { getErrorMessage } from "@/shared/lib/errors";
import { toast } from "@/shared/stores/toastStore";
import { Dialog } from "@/shared/ui/Dialog";

type WriteOffDialogProps = {
  open: boolean;
  onClose: () => void;
  ingredient: Ingredient | null;
};

export function WriteOffDialog({ open, onClose, ingredient }: WriteOffDialogProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const mutation = useWriteOffIngredient(ingredient?.id ?? "");

  useEffect(() => {
    if (!open) return;
    setQuantity("");
    setNote("");
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ingredient]);

  if (!ingredient) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ingredient) return;
    const toastMessage = t("warehouse.writeOffToast", { name: ingredient.name, quantity, unit: t(UNIT_LABELS[ingredient.unit]) });
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
    <Dialog open={open} onClose={onClose} title={t("warehouse.writeOffTitle", { name: ingredient.name })}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-white/50">
          {t("warehouse.available")}: <span className="font-semibold text-white">{ingredient.quantity}</span>{" "}
          {t(UNIT_LABELS[ingredient.unit])}
        </p>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
            {t("warehouse.quantityWithUnit", { unit: t(UNIT_LABELS[ingredient.unit]) })}
          </span>
          <input
            type="number"
            min={0.001}
            step="0.001"
            max={ingredient.quantity}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            autoFocus
            required
            className="input"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
            {t("warehouse.reasonOptional")}
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder={t("warehouse.reasonPlaceholder")}
            className="input"
          />
        </label>

        {mutation.isError && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
            {getErrorMessage(mutation.error, t("warehouse.writeOffFailed"))}
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
            className="rounded-xl bg-danger px-5 py-2 text-sm font-bold text-onaccent transition hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? t("common.saving") : t("warehouse.writeOff")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
