import { useEffect, useState } from "react";
import { Banknote, Check, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatPrice } from "@/entities/product/lib";
import { Dialog } from "@/shared/ui/Dialog";
import { useCartStore } from "@/shared/stores/cartStore";
import { useWeightEntryStore } from "@/shared/stores/weightEntryStore";

// Grams, not fractions of a kilogram — a cashier weighing food thinks and reads in grams (the
// scale's own display does too), so the whole dialog works in grams and only ever converts to
// kilograms once, right at the "Добавить" click, to match SaleItem.quantity's stored unit.
const QUICK_GRAMS = [250, 500, 750, 1000];

type EntryMode = "amount" | "weight";

/**
 * Mounted once (see PosCart.tsx) — reads its target from useWeightEntryStore instead of props,
 * so both PosMenu ("add this WEIGHT product") and PosCart ("edit this line's weight") can open it
 * from anywhere via `useWeightEntryStore.getState().open(target)` without either owning it.
 *
 * Two entry modes, since a cashier almost always hears "give me for 60 000" (an amount), not a
 * weight — "по сумме" is the default and does the division for them; "по весу" is the fallback
 * for the rarer case where a customer actually wants a specific weight. Both converge on the
 * same derived `grams`/`kg`/`total` below, so whichever mode was used, exactly the same number
 * lands in the cart, the receipt, stock, and every report.
 */
export function WeightEntryDialog() {
  const { t } = useTranslation();
  const target = useWeightEntryStore((s) => s.target);
  const close = useWeightEntryStore((s) => s.close);
  const setWeightQuantity = useCartStore((s) => s.setWeightQuantity);

  const [mode, setMode] = useState<EntryMode>("amount");
  const [amountInput, setAmountInput] = useState("");
  const [gramsInput, setGramsInput] = useState("");

  // Re-seed whenever a new target opens. Editing an already-weighed cart line defaults to "по
  // весу", pre-filled with its actual current weight (the amount that produced it was never
  // stored) — adding a fresh WEIGHT product always opens on "по сумме", the default mode most
  // customers' requests actually match.
  useEffect(() => {
    if (!target) return;
    const editing = Boolean(target.initialGrams);
    setMode(editing ? "weight" : "amount");
    setAmountInput("");
    setGramsInput(editing && target.initialGrams ? String(target.initialGrams) : "");
  }, [target]);

  const pricePerKg = Number(target?.unitPrice ?? 0);
  const pricePerGram = pricePerKg / 1000;

  // Whole grams only, however the mode computed them — a scale reads whole grams, and
  // SaleItem.quantity is stored to 3-decimal (gram) precision either way, so there's never a
  // reason to carry sub-gram fractions past this point.
  const grams =
    mode === "amount"
      ? pricePerGram > 0
        ? Math.round((Number(amountInput) || 0) / pricePerGram)
        : 0
      : Math.round(Number(gramsInput) || 0);

  const kg = grams / 1000;
  // Recomputed from the rounded weight, not an echo of whatever the cashier typed in "по сумме"
  // mode — this is the number that's actually charged, so it's what has to reconcile with the
  // cart/receipt/reports. It will usually land a few sum away from the typed amount (85 000/кг ÷
  // 1000 = 85 сум per gram, so rounding to the nearest gram can shift the total by at most half
  // that) — correct, not a bug: the weight is what's real, the typed sum was only ever a target.
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

          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-ink-soft p-1">
            <button
              type="button"
              onClick={() => setMode("amount")}
              className={`rounded-lg py-2 text-sm font-bold transition ${
                mode === "amount" ? "bg-champ text-onaccent shadow-card" : "text-white/50 hover:text-white"
              }`}
            >
              {t("pos.weight.byAmount")}
            </button>
            <button
              type="button"
              onClick={() => setMode("weight")}
              className={`rounded-lg py-2 text-sm font-bold transition ${
                mode === "weight" ? "bg-champ text-onaccent shadow-card" : "text-white/50 hover:text-white"
              }`}
            >
              {t("pos.weight.byWeight")}
            </button>
          </div>

          {mode === "amount" ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
                {t("pos.weight.enterAmount")}
              </label>
              <div className="relative">
                <Banknote className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="input pl-10 text-center text-2xl font-bold"
                />
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-ink-soft px-4 py-3">
                <span className="text-sm font-medium text-white/60">{t("pos.weight.calculatedWeight")}</span>
                <span className="text-lg font-extrabold text-champ">
                  {grams > 0 ? `${grams} ${t("pos.weight.gramsShort")}` : "—"}
                </span>
              </div>
            </div>
          ) : (
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
          )}

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
