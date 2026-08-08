import { useMemo, useState } from "react";
import { AlertTriangle, Minus, Package, PackageX, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useBulkRestockIngredients, useIngredients } from "@/entities/ingredient/api";
import { formatQuantity } from "@/entities/ingredient/lib";
import {
  getStockStatus,
  STOCK_STATUS_BADGE_CLASSES,
  STOCK_STATUS_LABELS,
  UNIT_LABELS,
  UNIT_OPTIONS,
  type Ingredient,
  type Unit,
} from "@/entities/ingredient/model";
import { getErrorMessage } from "@/shared/lib/errors";
import { toast } from "@/shared/stores/toastStore";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Skeleton, SkeletonStatCard } from "@/shared/ui/Skeleton";

const QUICK_AMOUNTS = [1, 2, 5, 10, 20];
// The intake grid needs every active ingredient on screen at once (not a paginated slice) so a
// cashier can work through a whole delivery in one pass — reuses the existing list endpoint,
// just asking for the full catalog in one request instead of adding a new "list all" route.
const ALL_INGREDIENTS_PAGE_SIZE = 500;

export function StockIntakeGrid() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useIngredients({ page: 1, pageSize: ALL_INGREDIENTS_PAGE_SIZE });
  const bulkRestock = useBulkRestockIngredients();

  const [searchInput, setSearchInput] = useState("");
  const [unit, setUnit] = useState<Unit | "">("");
  const [lowOnly, setLowOnly] = useState(false);
  const [outOnly, setOutOnly] = useState(false);
  // Draft quantities keyed by ingredient id — local to this page, not persisted anywhere until
  // "Сохранить приход" is pressed (component state is enough here; nothing needs to survive a
  // navigation away, unlike the POS cart which is why that one lives in a Zustand store).
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const allItems = data?.items ?? [];

  const stats = useMemo(() => {
    let low = 0;
    let out = 0;
    for (const ing of allItems) {
      const status = getStockStatus(ing.quantity, ing.minQuantity);
      if (status === "low") low++;
      else if (status === "out") out++;
    }
    return { total: allItems.length, low, out };
  }, [allItems]);

  const visibleItems = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return allItems.filter((ing) => {
      if (q && !ing.name.toLowerCase().includes(q)) return false;
      if (unit && ing.unit !== unit) return false;
      const status = getStockStatus(ing.quantity, ing.minQuantity);
      if (lowOnly && status !== "low") return false;
      if (outOnly && status !== "out") return false;
      return true;
    });
  }, [allItems, searchInput, unit, lowOnly, outOnly]);

  const pendingItems = useMemo(
    () =>
      Object.entries(drafts)
        .map(([ingredientId, value]) => ({ ingredientId, quantity: Number(value) }))
        .filter((item) => item.quantity > 0),
    [drafts],
  );

  function setDraft(id: string, value: string) {
    setDrafts((prev) => ({ ...prev, [id]: value }));
  }

  function addQuickAmount(id: string, amount: number) {
    setDrafts((prev) => {
      const next = (Number(prev[id]) || 0) + amount;
      // Avoid float artifacts like 0.30000000000000004 while still allowing decimals.
      return { ...prev, [id]: String(Math.round(next * 1000) / 1000) };
    });
  }

  function step(id: string, direction: 1 | -1) {
    setDrafts((prev) => {
      const next = Math.max(0, (Number(prev[id]) || 0) + direction);
      return { ...prev, [id]: String(Math.round(next * 1000) / 1000) };
    });
  }

  function handleSave() {
    if (pendingItems.length === 0 || bulkRestock.isPending) return;
    const count = pendingItems.length;
    bulkRestock.mutate(
      { items: pendingItems },
      {
        onSuccess: () => {
          toast.success(t("intake.saveSuccess", { count }));
          setDrafts({});
        },
        onError: (err) => toast.error(getErrorMessage(err, t("intake.saveFailed"))),
      },
    );
  }

  if (isError) {
    return (
      <p role="alert" className="rounded-card bg-ink-card p-6 text-center text-sm text-danger-soft shadow-card">
        {t("intake.loadError")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {isLoading ? (
          <>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </>
        ) : (
          <>
            <StatCard icon={Package} label={t("intake.statsTotal")} value={String(stats.total)} valueClass="text-white" />
            <StatCard
              icon={AlertTriangle}
              label={t("intake.statsLow")}
              value={String(stats.low)}
              valueClass={stats.low > 0 ? "text-warn" : "text-success"}
            />
            <StatCard
              icon={PackageX}
              label={t("intake.statsOut")}
              value={String(stats.out)}
              valueClass={stats.out > 0 ? "text-danger-soft" : "text-success"}
            />
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-card bg-ink-card p-4 shadow-card sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("intake.searchPlaceholder")}
            aria-label={t("intake.searchPlaceholder")}
            className="input pl-9"
          />
        </div>

        <select value={unit} onChange={(e) => setUnit(e.target.value as Unit | "")} className="input sm:w-36">
          <option value="">{t("intake.allUnits")}</option>
          {UNIT_OPTIONS.map((u) => (
            <option key={u} value={u}>
              {t(UNIT_LABELS[u])}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-white/70">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => setLowOnly(e.target.checked)}
            className="h-4 w-4 rounded border-ink-line bg-ink-soft accent-champ"
          />
          {t("intake.lowOnly")}
        </label>

        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-white/70">
          <input
            type="checkbox"
            checked={outOnly}
            onChange={(e) => setOutOnly(e.target.checked)}
            className="h-4 w-4 rounded border-ink-line bg-ink-soft accent-champ"
          />
          {t("intake.outOnly")}
        </label>

        <div className="flex flex-1 items-center justify-end gap-2">
          {pendingItems.length > 0 && (
            <button
              type="button"
              onClick={() => setDrafts({})}
              className="rounded-xl border border-ink-line px-3 py-2.5 text-xs font-medium text-white/60 transition hover:text-white"
            >
              {t("intake.clearAll")}
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={pendingItems.length === 0 || bulkRestock.isPending}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-champ px-4 py-2.5 text-sm font-bold text-onaccent transition hover:bg-champ-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {bulkRestock.isPending
              ? t("intake.saving")
              : pendingItems.length > 0
                ? t("intake.saveWithCount", { count: pendingItems.length })
                : t("intake.save")}
          </button>
        </div>
      </div>

      <div className="rounded-card bg-ink-card shadow-card">
        {isLoading && (
          <div className="divide-y divide-ink-line p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="my-2 h-16 w-full" />
            ))}
          </div>
        )}

        {!isLoading && allItems.length === 0 && (
          <EmptyState icon={Package} title={t("intake.noIngredientsTitle")} description={t("intake.noIngredientsDescription")} />
        )}

        {!isLoading && allItems.length > 0 && visibleItems.length === 0 && (
          <EmptyState compact icon={Search} title={t("intake.empty")} description={t("intake.emptyDescription")} />
        )}

        {!isLoading && visibleItems.length > 0 && (
          <div className="divide-y divide-ink-line">
            {visibleItems.map((ingredient) => (
              <IntakeRow
                key={ingredient.id}
                ingredient={ingredient}
                draft={drafts[ingredient.id] ?? ""}
                onDraftChange={(v) => setDraft(ingredient.id, v)}
                onStep={(dir) => step(ingredient.id, dir)}
                onQuickAmount={(amount) => addQuickAmount(ingredient.id, amount)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="rounded-card bg-ink-card p-4 shadow-card sm:p-5">
      <Icon className="h-4 w-4 text-champ" />
      <p className={`mt-2 text-xl font-bold sm:text-2xl ${valueClass}`}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-white/40">{label}</p>
    </div>
  );
}

function IntakeRow({
  ingredient,
  draft,
  onDraftChange,
  onStep,
  onQuickAmount,
}: {
  ingredient: Ingredient;
  draft: string;
  onDraftChange: (value: string) => void;
  onStep: (direction: 1 | -1) => void;
  onQuickAmount: (amount: number) => void;
}) {
  const { t } = useTranslation();
  const status = getStockStatus(ingredient.quantity, ingredient.minQuantity);
  const isWholeUnit = ingredient.unit === "PIECE";
  const hasDraft = Number(draft) > 0;

  return (
    <div className={`flex flex-wrap items-center gap-4 p-4 transition lg:flex-nowrap ${hasDraft ? "bg-champ/5" : ""}`}>
      <div className="min-w-[10rem] flex-1">
        <p className="font-medium text-white">{ingredient.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/40">
            {t("intake.currentStock")}: {formatQuantity(ingredient.quantity)} {t(UNIT_LABELS[ingredient.unit])}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STOCK_STATUS_BADGE_CLASSES[status]}`}
          >
            {t(STOCK_STATUS_LABELS[status])}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <StepButton label={t("intake.decrease")} onClick={() => onStep(-1)}>
          <Minus className="h-3.5 w-3.5" />
        </StepButton>
        <input
          type="number"
          min={0}
          step={isWholeUnit ? 1 : 0.001}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="0"
          className="input w-20 text-center"
        />
        <StepButton label={t("intake.increase")} onClick={() => onStep(1)}>
          <Plus className="h-3.5 w-3.5" />
        </StepButton>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1.5">
        {QUICK_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => onQuickAmount(amount)}
            className="rounded-lg bg-ink-soft px-2.5 py-1.5 text-xs font-bold text-white/60 transition hover:bg-ink-line hover:text-white"
          >
            +{amount}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink-line text-white/60 transition hover:border-champ/50 hover:text-white active:scale-90"
    >
      {children}
    </button>
  );
}
