import { CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useIngredients } from "@/entities/ingredient/api";
import { formatQuantityWithUnit } from "@/entities/ingredient/lib";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Skeleton } from "@/shared/ui/Skeleton";

/** Reuses Module 3's ingredient list + its existing `lowStock` filter — no new backend needed. */
export function LowStockList() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useIngredients({ lowStock: true, page: 1, pageSize: 10 });

  return (
    <div className="rounded-card bg-ink-card p-4 shadow-card sm:p-6">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-white/50">{t("dashboard.lowStock")}</h2>

      {isLoading && (
        <div className="divide-y divide-ink-line">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {isError && <p role="alert" className="py-6 text-center text-sm text-danger-soft">{t("dashboard.lowStockLoadError")}</p>}

      {!isError && data && data.items.length === 0 && (
        <EmptyState compact icon={CircleCheck} title={t("dashboard.stockAllNormal")} />
      )}

      {!isError && data && data.items.length > 0 && (
        <div className="divide-y divide-ink-line">
          {data.items.map((ingredient) => (
            <div key={ingredient.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <p className="truncate text-sm text-white">{ingredient.name}</p>
              <p className="shrink-0 text-sm font-semibold text-warn">{formatQuantityWithUnit(ingredient.quantity, ingredient.unit)}</p>
            </div>
          ))}
          {data.total > data.items.length && (
            <p className="pt-2.5 text-xs text-white/30">{t("dashboard.andMore", { count: data.total - data.items.length })}</p>
          )}
        </div>
      )}
    </div>
  );
}
