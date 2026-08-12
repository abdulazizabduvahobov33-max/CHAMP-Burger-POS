import { useEffect, useState } from "react";
import { Check, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatPrice } from "@/entities/product/lib";
import { Dialog } from "@/shared/ui/Dialog";
import { useCartStore } from "@/shared/stores/cartStore";
import { useWeightEntryStore } from "@/shared/stores/weightEntryStore";

// Grams, not fractions of a kilogram — a cashier weighing food thinks and reads in grams (the
// scale's own display does too), so the whole dialog works in grams and only ever converts to
// kilograms once, right at the "Добавить" click, to match SaleItem.quantity's stored unit.
const QUICK_GRAMS = [250, 500, 750, 1000];

/**
 * Mounted once (see PosCart.tsx) — reads its target from useWeightEntryStore instead of props,
 * so both PosMenu ("add this WEIGHT product") and PosCart ("edit this line's weight") can open it
 * from anywhere via `useWeightEntryStore.getState().open(target)` without either owning it.
 */
export function WeightEntryDialog() {
  const { t } = useTranslation();
  const target = useWeightEntryStore((s) => s.target);
  const close = useWeightEntryStore((s) => s.close);
  const setWeightQuantity = useCartStore((s) => s.setWeightQuantity);
  const [gramsInput, setGramsInput] = useState("");

  // Re-seed whenever a new target opens — either blank (adding fresh) or the line's current
  // weight in grams (editing), never a stale value left over from the previous product.
  useEffect(() => {
    if (target) setGramsInput(target.initialGrams ? String(target.initialGrams) : "");
  }, [target]);

  const grams = Number(gramsInput) || 0;
  const kg = grams / 1000;
  const pricePerKg = Number(target?.unitPrice ?? 0);
  const total = kg * pricePerKg;
  const isValid = grams > 0;
  const isEditing = Boolean(target?.initialGrams);

  function handleConfirm() {
    if (!target || !isValid) return;
    setWeightQuantity(
      {
        variantId: target.variantId,
        productId: target.productId,
        productName: target.productName,
        variantLabel: target.variantLabel,
        imageUrl: target.imageUrl,
        unitPrice: target.unitPrice,
        saleType: "WEIGHT",
      },
      kg,
    );
    close();
  }

  return (
    <Dialog open={target !== null} onClose={close} title={target?.productName ?? ""} widthClassName="max-w-sm">
      {target && (
        <div className="space-y-5">
          <div className="rounded-xl bg-ink-soft p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-white/40">{t("pos.weight.pricePerKg")}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-champ">{formatPrice(target.unitPrice)}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              {t("pos.weight.enterWeight")}
            </label>
            <div className="relative">
              <Scale className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={gramsInput}
                onChange={(e) => setGramsInput(e.target.value)}
                autoFocus
                onFocus={(e) => e.target.select()}
                placeholder="0"
                className="input pl-10 pr-14 text-center text-2xl font-bold"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-white/40">
                {t("pos.weight.gramsShort")}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_GRAMS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGramsInput(String(g))}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    grams === g ? "bg-champ text-onaccent" : "bg-ink-soft text-white/60 hover:bg-ink-line hover:text-white"
                  }`}
                >
                  {g} {t("pos.weight.gramsShort")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-champ/40 bg-champ/10 px-4 py-3">
            <span className="text-sm font-medium text-white/70">{t("pos.total")}</span>
            <span className="text-xl font-extrabold tracking-tight text-champ">{formatPrice(String(total))}</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-xl border border-ink-line py-3 text-sm font-medium text-white/70 transition hover:text-white"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isValid}
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-champ py-3 text-sm font-bold text-onaccent shadow-card transition hover:bg-champ-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              <Check className="h-4 w-4" />
              {isEditing ? t("common.save") : t("pos.weight.add")}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
