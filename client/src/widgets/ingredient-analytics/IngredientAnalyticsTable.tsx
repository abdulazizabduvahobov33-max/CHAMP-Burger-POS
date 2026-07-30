import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChartBar } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useIngredientAnalytics } from "@/entities/report/api";
import { UNIT_LABELS } from "@/entities/ingredient/model";
import { formatPrice } from "@/entities/product/lib";
import { isDateFilterReady, type DateFilter, type IngredientAnalyticsSort } from "@/entities/report/model";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Pagination } from "@/shared/ui/Pagination";
import { SkeletonTableRows } from "@/shared/ui/Skeleton";

const PAGE_SIZE = 10;

const COLUMNS: { key: IngredientAnalyticsSort; labelKey: string }[] = [
  { key: "consumption", labelKey: "report.ingredientAnalytics.columns.consumption" },
  { key: "cost", labelKey: "report.ingredientAnalytics.columns.cost" },
  { key: "quantity", labelKey: "report.ingredientAnalytics.columns.quantity" },
  { key: "forecastDays", labelKey: "report.ingredientAnalytics.columns.forecastDays" },
];

export function IngredientAnalyticsTable({ filter }: { filter: DateFilter }) {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<IngredientAnalyticsSort>("consumption");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useIngredientAnalytics(filter, { sortBy, sortDir, page, pageSize: PAGE_SIZE });
  const rangeIncomplete = !isDateFilterReady(filter);

  // Same reasoning as ProductProfitabilityTable — a narrower period can shrink the result set
  // out from under whichever page was showing.
  useEffect(() => {
    setPage(1);
  }, [filter]);

  function toggleSort(key: IngredientAnalyticsSort) {
    if (sortBy === key) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
    setPage(1);
  }

  return (
    <div className="rounded-card bg-ink-card shadow-card">
      <div className="border-b border-ink-line p-4 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white/50">{t("report.ingredientAnalytics.title")}</h2>
      </div>

      {rangeIncomplete && <p className="px-6 py-10 text-center text-sm text-white/40">{t("report.selectBothDates")}</p>}
      {!rangeIncomplete && isLoading && <SkeletonTableRows rows={6} columns={5} />}
      {!rangeIncomplete && isError && (
        <p role="alert" className="px-6 py-10 text-center text-sm text-danger-soft">
          {t("report.ingredientAnalytics.loadError")}
        </p>
      )}
      {!rangeIncomplete && data && data.items.length === 0 && (
        <EmptyState
          icon={ChartBar}
          title={t("report.ingredientAnalytics.emptyTitle")}
          description={t("report.ingredientAnalytics.emptyDescription")}
        />
      )}

      {!rangeIncomplete && data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-6 py-3 font-medium">{t("report.ingredientAnalytics.columns.name")}</th>
                  {COLUMNS.map((col) => (
                    <th key={col.key} className="px-6 py-3 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="flex items-center gap-1 transition hover:text-white"
                      >
                        {t(col.labelKey)}
                        {sortBy === col.key &&
                          (sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line">
                {data.items.map((row) => (
                  <tr key={row.id} className="transition hover:bg-ink-soft/60">
                    <td className="px-6 py-3 text-white">{row.name}</td>
                    <td className="px-6 py-3 text-white/70">
                      {row.consumed} {t(UNIT_LABELS[row.unit])}
                    </td>
                    <td className="px-6 py-3 text-white/70">{formatPrice(row.cost)}</td>
                    <td className="px-6 py-3 text-white/70">
                      {row.quantity} {t(UNIT_LABELS[row.unit])}
                    </td>
                    <td className="px-6 py-3">
                      <ForecastCell days={row.forecastDays} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function ForecastCell({ days }: { days: string | null }) {
  const { t } = useTranslation();
  if (days === null) {
    return <span className="text-white/30">{t("report.ingredientAnalytics.noData")}</span>;
  }
  const value = Number(days);
  const urgent = value <= 7;
  return (
    <span className={urgent ? "font-semibold text-danger-soft" : "text-white/70"}>
      {t("report.ingredientAnalytics.daysShort", { count: days })}
    </span>
  );
}
