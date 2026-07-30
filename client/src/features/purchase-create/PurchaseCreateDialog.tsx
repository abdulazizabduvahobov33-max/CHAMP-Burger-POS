import { useEffect, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useIngredients } from "@/entities/ingredient/api";
import { UNIT_LABELS } from "@/entities/ingredient/model";
import { useCreatePurchase } from "@/entities/purchase/api";
import { formatPrice } from "@/entities/product/lib";
import { useSuppliers } from "@/entities/supplier/api";
import { getErrorMessage } from "@/shared/lib/errors";
import { toast } from "@/shared/stores/toastStore";
import { Dialog } from "@/shared/ui/Dialog";

type PurchaseRow = { ingredientId: string; packQuantity: string; unitsPerPack: string; packPrice: string };

const EMPTY_ROW: PurchaseRow = { ingredientId: "", packQuantity: "1", unitsPerPack: "1", packPrice: "" };

type PurchaseCreateDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function PurchaseCreateDialog({ open, onClose }: PurchaseCreateDialogProps) {
  const { t } = useTranslation();
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<PurchaseRow[]>([{ ...EMPTY_ROW }]);

  const { data: suppliers } = useSuppliers();
  const { data: ingredients } = useIngredients({ page: 1, pageSize: 100 });
  const createMutation = useCreatePurchase();

  useEffect(() => {
    if (!open) return;
    setSupplierId("");
    setNote("");
    setRows([{ ...EMPTY_ROW }]);
    createMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function updateRow(index: number, patch: Partial<PurchaseRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const validRows = rows.filter(
    (r) => r.ingredientId && Number(r.packQuantity) > 0 && Number(r.unitsPerPack) > 0 && r.packPrice !== "" && Number(r.packPrice) >= 0,
  );
  const grandTotal = validRows.reduce((sum, r) => sum + Number(r.packQuantity) * Number(r.packPrice), 0);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (validRows.length === 0) return;
    createMutation.mutate(
      {
        supplierId: supplierId || undefined,
        note: note.trim() || undefined,
        items: validRows.map((r) => ({
          ingredientId: r.ingredientId,
          packQuantity: Number(r.packQuantity),
          unitsPerPack: Number(r.unitsPerPack),
          packPrice: Number(r.packPrice),
        })),
      },
      {
        onSuccess: () => {
          toast.success(t("purchase.createSuccess"));
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("purchase.createTitle")} widthClassName="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              {t("purchase.supplier")}
            </span>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input">
              <option value="">{t("purchase.supplierNotSpecified")}</option>
              {suppliers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              {t("purchase.comment")}
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              className="input"
              placeholder={t("purchase.optional")}
            />
          </label>
        </div>

        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_5rem_5rem_6rem_2rem] gap-2 px-1 text-xs font-medium uppercase tracking-wide text-white/40 sm:grid">
            <span>{t("purchase.columns.ingredient")}</span>
            <span>{t("purchase.columns.packs")}</span>
            <span>{t("purchase.columns.unitsPerPack")}</span>
            <span>{t("purchase.columns.packPrice")}</span>
            <span />
          </div>

          {rows.map((row, i) => {
            const ingredient = ingredients?.items.find((ing) => ing.id === row.ingredientId);
            return (
              <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_5rem_5rem_6rem_2rem]">
                <select
                  value={row.ingredientId}
                  onChange={(e) => updateRow(i, { ingredientId: e.target.value })}
                  className="input col-span-2 sm:col-span-1"
                >
                  <option value="" disabled>
                    {t("product.form.selectPlaceholder")}
                  </option>
                  {ingredients?.items.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0.001}
                  step="0.001"
                  value={row.packQuantity}
                  onChange={(e) => updateRow(i, { packQuantity: e.target.value })}
                  className="input"
                  placeholder={t("purchase.quantityPlaceholder")}
                />
                <input
                  type="number"
                  min={0.001}
                  step="0.001"
                  value={row.unitsPerPack}
                  onChange={(e) => updateRow(i, { unitsPerPack: e.target.value })}
                  className="input"
                  placeholder={ingredient ? t(UNIT_LABELS[ingredient.unit]) : t("purchase.unitPlaceholder")}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.packPrice}
                  onChange={(e) => updateRow(i, { packPrice: e.target.value })}
                  className="input"
                  placeholder={t("purchase.pricePlaceholder")}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  aria-label={t("purchase.removeRow")}
                  className="flex items-center justify-center rounded-lg text-white/40 transition hover:text-danger-soft disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-xs font-medium text-champ transition hover:text-champ-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("purchase.addRow")}
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-ink-line pt-3 text-sm">
          <span className="text-white/60">{t("purchase.total")}</span>
          <span className="text-lg font-bold text-champ">{formatPrice(String(grandTotal))}</span>
        </div>

        {createMutation.isError && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
            {getErrorMessage(createMutation.error, t("purchase.createFailed"))}
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
            disabled={createMutation.isPending || validRows.length === 0}
            className="rounded-xl bg-champ px-5 py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createMutation.isPending ? t("common.saving") : t("purchase.submit")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
