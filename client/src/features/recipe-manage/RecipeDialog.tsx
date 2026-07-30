import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useIngredients } from "@/entities/ingredient/api";
import { UNIT_LABELS } from "@/entities/ingredient/model";
import { useRecipe, useSetRecipe } from "@/entities/recipe/api";
import type { Product } from "@/entities/product/model";
import { getErrorMessage } from "@/shared/lib/errors";
import { toast } from "@/shared/stores/toastStore";
import { Dialog } from "@/shared/ui/Dialog";
import { Skeleton } from "@/shared/ui/Skeleton";

type RecipeRow = { ingredientId: string; quantity: string };

type RecipeDialogProps = {
  open: boolean;
  onClose: () => void;
  product: Product | null;
};

export function RecipeDialog({ open, onClose, product }: RecipeDialogProps) {
  const { t } = useTranslation();
  const [variantId, setVariantId] = useState<string | undefined>(product?.variants[0]?.id);
  const [rows, setRows] = useState<RecipeRow[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVariantId(product?.variants[0]?.id);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  const { data: ingredients } = useIngredients({ page: 1, pageSize: 100 });
  const { data: recipe, isLoading } = useRecipe(variantId ?? "", { enabled: open && Boolean(variantId) });
  const setRecipeMutation = useSetRecipe(variantId ?? "");

  useEffect(() => {
    if (!recipe) return;
    setRows(recipe.map((line) => ({ ingredientId: line.ingredientId, quantity: line.quantity })));
    // Deliberately not resetting `saved` here: a successful save rewrites the same query
    // cache entry this effect watches, so doing it here would erase the "saved" confirmation
    // in the same tick it appears. Switching variants is what should hide it — see below.
  }, [recipe]);

  useEffect(() => {
    setSaved(false);
  }, [variantId]);

  if (!product) return null;

  function updateRow(index: number, patch: Partial<RecipeRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const used = new Set(rows.map((r) => r.ingredientId));
    const next = ingredients?.items.find((i) => !used.has(i.id));
    setRows((prev) => [...prev, { ingredientId: next?.id ?? "", quantity: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const validRows = rows.filter((r) => r.ingredientId && r.quantity !== "" && Number(r.quantity) > 0);
  const hasDuplicates = new Set(validRows.map((r) => r.ingredientId)).size !== validRows.length;
  const incompleteCount = rows.length - validRows.length;

  function handleSave() {
    if (hasDuplicates) return;
    setSaved(false);
    setRecipeMutation.mutate(
      validRows.map((r) => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) })),
      {
        onSuccess: () => {
          setSaved(true);
          toast.success(t("recipe.saved"));
        },
      },
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("recipe.dialogTitle", { name: product.name })} widthClassName="max-w-lg">
      {product.variants.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {product.variants.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVariantId(v.id)}
              disabled={setRecipeMutation.isPending}
              title={setRecipeMutation.isPending ? t("recipe.waitForSave") : undefined}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                v.id === variantId ? "bg-champ text-onaccent" : "bg-ink-soft text-white/60 hover:text-white"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-8 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-white/40">{t("recipe.noIngredients")}</p>
          )}

          {rows.map((row, i) => {
            const ingredient = ingredients?.items.find((ing) => ing.id === row.ingredientId);
            return (
              <div key={i} className="flex gap-2">
                <select
                  value={row.ingredientId}
                  onChange={(e) => updateRow(i, { ingredientId: e.target.value })}
                  className="input flex-1"
                >
                  <option value="" disabled>
                    {t("recipe.selectIngredient")}
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
                  value={row.quantity}
                  onChange={(e) => updateRow(i, { quantity: e.target.value })}
                  placeholder={ingredient ? t(UNIT_LABELS[ingredient.unit]) : t("recipe.quantityPlaceholder")}
                  className="input w-28"
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label={t("recipe.removeIngredient")}
                  className="shrink-0 rounded-lg p-2 text-white/40 transition hover:text-danger-soft"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addRow}
            disabled={!ingredients || rows.length >= ingredients.items.length}
            className="flex items-center gap-1.5 text-xs font-medium text-champ transition hover:text-champ-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("recipe.addIngredient")}
          </button>

          {hasDuplicates && (
            <p className="text-xs text-danger-soft">{t("recipe.duplicateIngredient")}</p>
          )}

          {!hasDuplicates && incompleteCount > 0 && (
            <p className="text-xs text-warn">
              {incompleteCount === 1
                ? t("recipe.incompleteRowSingle")
                : t("recipe.incompleteRowMultiple", { count: incompleteCount })}
            </p>
          )}

          {setRecipeMutation.isError && (
            <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
              {getErrorMessage(setRecipeMutation.error, t("recipe.saveFailed"))}
            </div>
          )}

          {saved && !setRecipeMutation.isError && (
            <p className="text-xs text-success">{t("recipe.saved")}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-ink-line px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white"
            >
              {t("common.close")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={setRecipeMutation.isPending || hasDuplicates}
              className="rounded-xl bg-champ px-5 py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {setRecipeMutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
