import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { useCreateIngredient, useUpdateIngredient } from "@/entities/ingredient/api";
import { UNIT_LABELS, UNIT_OPTIONS, type Ingredient, type Unit } from "@/entities/ingredient/model";
import { getErrorMessage } from "@/shared/lib/errors";
import { toast } from "@/shared/stores/toastStore";
import { Dialog } from "@/shared/ui/Dialog";

type IngredientFormDialogProps = {
  open: boolean;
  onClose: () => void;
  ingredient?: Ingredient | null;
};

export function IngredientFormDialog({ open, onClose, ingredient }: IngredientFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(ingredient);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("PIECE");
  const [minQuantity, setMinQuantity] = useState("0");

  const createMutation = useCreateIngredient();
  const updateMutation = useUpdateIngredient(ingredient?.id ?? "");
  const mutation = isEdit ? updateMutation : createMutation;

  useEffect(() => {
    if (!open) return;
    setName(ingredient?.name ?? "");
    setUnit(ingredient?.unit ?? "PIECE");
    setMinQuantity(ingredient?.minQuantity ?? "0");
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ingredient]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate(
      { name: name.trim(), unit, minQuantity: Number(minQuantity) },
      {
        onSuccess: () => {
          toast.success(isEdit ? t("warehouse.form.updateSuccess") : t("warehouse.form.createSuccess"));
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? t("warehouse.form.editTitle") : t("warehouse.form.createTitle")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">{t("warehouse.form.name")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
            maxLength={120}
            className="input"
            placeholder={t("warehouse.form.namePlaceholder")}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              {t("warehouse.form.unit")}
            </span>
            <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className="input">
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {t(UNIT_LABELS[u])}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              {t("warehouse.form.minQuantity")}
            </span>
            <input
              type="number"
              min={0}
              step="0.001"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
              required
              className="input"
            />
          </label>
        </div>

        {mutation.isError && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
            {getErrorMessage(mutation.error, t("common.saveFailed"))}
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
            disabled={mutation.isPending || !name.trim()}
            className="rounded-xl bg-champ px-5 py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? t("common.saving") : isEdit ? t("common.save") : t("common.create")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
