import { useState } from "react";
import { History, PackageMinus, PackagePlus, Pencil, Plus, Search, Trash2, Warehouse } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useDeleteIngredient, useIngredients } from "@/entities/ingredient/api";
import { formatQuantity } from "@/entities/ingredient/lib";
import { UNIT_LABELS, UNIT_OPTIONS, type Ingredient, type Unit } from "@/entities/ingredient/model";
import { IngredientFormDialog } from "@/features/ingredient-form/IngredientFormDialog";
import { MovementsDialog } from "@/features/stock-movements/MovementsDialog";
import { RestockDialog } from "@/features/stock-restock/RestockDialog";
import { WriteOffDialog } from "@/features/stock-writeoff/WriteOffDialog";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Pagination } from "@/shared/ui/Pagination";
import { SkeletonTableRows } from "@/shared/ui/Skeleton";
import { useDebouncedValue } from "@/shared/lib/useDebouncedValue";

const PAGE_SIZE = 10;

export function WarehouseTable() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [unit, setUnit] = useState<Unit | "">("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput);

  const { data, isLoading, isError } = useIngredients({
    search,
    unit: unit || undefined,
    lowStock: lowStockOnly,
    page,
    pageSize: PAGE_SIZE,
  });

  const [formTarget, setFormTarget] = useState<Ingredient | null | undefined>(undefined);
  const [restockTarget, setRestockTarget] = useState<Ingredient | null>(null);
  const [writeOffTarget, setWriteOffTarget] = useState<Ingredient | null>(null);
  const [movementsTarget, setMovementsTarget] = useState<Ingredient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);

  const deleteMutation = useDeleteIngredient();

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div className="rounded-card bg-ink-card shadow-card">
      <div className="flex flex-col gap-3 border-b border-ink-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={searchInput}
              onChange={(e) => resetToFirstPage(setSearchInput)(e.target.value)}
              placeholder={t("warehouse.searchPlaceholder")}
              aria-label={t("warehouse.searchPlaceholder")}
              className="input pl-9"
            />
          </div>

          <select
            value={unit}
            onChange={(e) => resetToFirstPage(setUnit)(e.target.value as Unit | "")}
            className="input sm:w-36"
          >
            <option value="">{t("warehouse.allUnits")}</option>
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {t(UNIT_LABELS[u])}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-white/70">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => resetToFirstPage(setLowStockOnly)(e.target.checked)}
              className="h-4 w-4 rounded border-ink-line bg-ink-soft accent-champ"
            />
            {t("warehouse.lowStockOnly")}
          </label>
        </div>

        <button
          type="button"
          onClick={() => setFormTarget(null)}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-champ px-4 py-2.5 text-sm font-bold text-onaccent transition hover:bg-champ-hover"
        >
          <Plus className="h-4 w-4" />
          {t("warehouse.addIngredient")}
        </button>
      </div>

      {isLoading && <SkeletonTableRows rows={6} columns={4} />}
      {isError && <p className="px-6 py-10 text-center text-sm text-danger-soft">{t("warehouse.loadError")}</p>}

      {data && data.items.length === 0 && (
        <EmptyState
          icon={Warehouse}
          title={search || unit || lowStockOnly ? t("common.noResultsTitle") : t("warehouse.emptyTitle")}
          description={search || unit || lowStockOnly ? t("common.noResultsDescription") : t("warehouse.emptyDescription")}
          action={
            search || unit || lowStockOnly
              ? undefined
              : { label: t("warehouse.addIngredient"), icon: Plus, onClick: () => setFormTarget(null) }
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-6 py-3 font-medium">{t("warehouse.columns.name")}</th>
                  <th className="px-6 py-3 font-medium">{t("warehouse.columns.unit")}</th>
                  <th className="px-6 py-3 font-medium">{t("warehouse.columns.quantity")}</th>
                  <th className="px-6 py-3 font-medium">{t("warehouse.columns.minQuantity")}</th>
                  <th className="px-6 py-3 font-medium">{t("warehouse.columns.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line">
                {data.items.map((ingredient) => (
                  <tr key={ingredient.id} className={`transition hover:bg-ink-soft/60 ${ingredient.isLow ? "bg-warn/5" : ""}`}>
                    <td className="px-6 py-3 font-medium text-white">{ingredient.name}</td>
                    <td className="px-6 py-3 text-white/60">{t(UNIT_LABELS[ingredient.unit])}</td>
                    <td className={`px-6 py-3 font-semibold ${ingredient.isLow ? "text-warn" : "text-white"}`}>
                      {formatQuantity(ingredient.quantity)}
                    </td>
                    <td className="px-6 py-3 text-white/50">{formatQuantity(ingredient.minQuantity)}</td>
                    <td className="px-6 py-3">
                      <RowActions
                        ingredient={ingredient}
                        onEdit={() => setFormTarget(ingredient)}
                        onRestock={() => setRestockTarget(ingredient)}
                        onWriteOff={() => setWriteOffTarget(ingredient)}
                        onHistory={() => setMovementsTarget(ingredient)}
                        onDelete={() => setDeleteTarget(ingredient)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 p-4 md:hidden">
            {data.items.map((ingredient) => (
              <div key={ingredient.id} className="rounded-xl border border-ink-line bg-ink-soft p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="font-medium text-white">{ingredient.name}</p>
                    <p className="text-xs text-white/40">{t(UNIT_LABELS[ingredient.unit])}</p>
                  </div>
                  <p className={`text-lg font-bold ${ingredient.isLow ? "text-warn" : "text-white"}`}>
                    {formatQuantity(ingredient.quantity)}
                  </p>
                </div>
                <p className="mb-3 text-xs text-white/40">
                  {t("warehouse.columns.minQuantity")}: {formatQuantity(ingredient.minQuantity)} {t(UNIT_LABELS[ingredient.unit])}
                </p>
                <RowActions
                  ingredient={ingredient}
                  onEdit={() => setFormTarget(ingredient)}
                  onRestock={() => setRestockTarget(ingredient)}
                  onWriteOff={() => setWriteOffTarget(ingredient)}
                  onHistory={() => setMovementsTarget(ingredient)}
                  onDelete={() => setDeleteTarget(ingredient)}
                />
              </div>
            ))}
          </div>

          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}

      <IngredientFormDialog open={formTarget !== undefined} onClose={() => setFormTarget(undefined)} ingredient={formTarget} />
      <RestockDialog open={restockTarget !== null} onClose={() => setRestockTarget(null)} ingredient={restockTarget} />
      <WriteOffDialog open={writeOffTarget !== null} onClose={() => setWriteOffTarget(null)} ingredient={writeOffTarget} />
      <MovementsDialog open={movementsTarget !== null} onClose={() => setMovementsTarget(null)} ingredient={movementsTarget} />
      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("warehouse.deleteTitle")}
        description={t("warehouse.deleteDescription", { name: deleteTarget?.name })}
        confirmLabel={t("warehouse.delete")}
        danger
        pending={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </div>
  );
}

function RowActions({
  ingredient,
  onEdit,
  onRestock,
  onWriteOff,
  onHistory,
  onDelete,
}: {
  ingredient: Ingredient;
  onEdit: () => void;
  onRestock: () => void;
  onWriteOff: () => void;
  onHistory: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <IconButton label={t("warehouse.restock")} onClick={onRestock}>
        <PackagePlus className="h-4 w-4" />
      </IconButton>
      <IconButton label={t("warehouse.writeOff")} onClick={onWriteOff} disabled={Number(ingredient.quantity) <= 0}>
        <PackageMinus className="h-4 w-4" />
      </IconButton>
      <IconButton label={t("warehouse.history")} onClick={onHistory}>
        <History className="h-4 w-4" />
      </IconButton>
      <IconButton label={t("warehouse.edit")} onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </IconButton>
      <IconButton label={t("warehouse.delete")} onClick={onDelete} tone="danger">
        <Trash2 className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  tone = "default",
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`rounded-lg p-2.5 text-white/50 transition hover:bg-ink-line hover:text-white disabled:cursor-not-allowed disabled:opacity-30 ${
        tone === "danger" ? "hover:!text-danger-soft" : ""
      }`}
    >
      {children}
    </button>
  );
}
