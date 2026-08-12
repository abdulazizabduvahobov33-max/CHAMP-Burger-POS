import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useProductProfitability } from "@/entities/report/api";
import { formatPrice, formatSaleQuantity, profitColorClass } from "@/entities/product/lib";
import { isDateFilterReady, type DateFilter, type ProductProfitabilitySort } from "@/entities/report/model";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Pagination } from "@/shared/ui/Pagination";
import { SkeletonTableRows } from "@/shared/ui/Skeleton";

const PAGE_SIZE = 10;

const COLUMNS: { key: ProductProfitabilitySort; labelKey: string }[] = [
  { key: "quantity", labelKey: "profit.columns.quantity" },
  { key: "revenue", labelKey: "profit.columns.revenue" },
  { key: "cost", labelKey: "profit.columns.cost" },
  { key: "profit", labelKey: "profit.columns.profit" },
  { key: "margin", labelKey: "profit.columns.margin" },
];

export function ProductProfitabilityTable({ filter }: { filter: DateFilter }) {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<ProductProfitabilitySort>("profit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useProductProfitability(filter, { sortBy, sortDir, page, pageSize: PAGE_SIZE });
  const rangeIncomplete = !isDateFilterReady(filter);

  // Switching the date range can shrink the result set out from under the current page
  // (e.g. going from "Месяц" to "Сегодня" on page 3) — land back on page 1 for the new set,
  // same as SalesTable/PurchasesTable already do for their own filter changes.
  useEffect(() => {
    setPage(1);
  }, [filter]);

  function toggleSort(key: ProductProfitabilitySort) {
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
        <h2 className="text-sm font-bold uppercase tracking-wide text-white/50">{t("profit.tableTitle")}</h2>
      </div>

      {rangeIncomplete && <p className="px-6 py-10 text-center text-sm text-white/40">{t("report.selectBothDates")}</p>}
      {!rangeIncomplete && isLoading && <SkeletonTableRows rows={6} columns={6} />}
      {!rangeIncomplete && isError && (
        <p role="alert" className="px-6 py-10 text-center text-sm text-danger-soft">
          {t("profit.loadError")}
        </p>
      )}
      {!rangeIncomplete && data && data.items.length === 0 && (
        <EmptyState icon={TrendingUp} title={t("profit.emptyTitle")} description={t("profit.emptyDescription")} />
      )}

      {!rangeIncomplete && data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-6 py-3 font-medium">{t("profit.columns.name")}</th>
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
                  <tr key={row.variantId} className="transition hover:bg-ink-soft/60">
                    <td className="px-6 py-3">
                      <p className="text-white">{row.productName}</p>
                      {row.saleType !== "WEIGHT" && <p className="text-xs text-white/40">{row.variantLabel}</p>}
                    </td>
                    <td className="px-6 py-3 text-white/70">{formatSaleQuantity(row.quantitySold, row.saleType)}</td>
                    <td className="px-6 py-3 text-white/70">{formatPrice(row.revenue)}</td>
                    <td className="px-6 py-3 text-white/50">{row.hasCostData ? formatPrice(row.cost) : "—"}</td>
                    <td className={`px-6 py-3 font-semibold ${row.hasCostData ? profitColorClass(row.profit) : "text-white/50"}`}>
                      {row.hasCostData ? formatPrice(row.profit) : "—"}
                    </td>
                    <td className="px-6 py-3 text-white/70">{row.hasCostData ? `${row.margin}%` : "—"}</td>
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
