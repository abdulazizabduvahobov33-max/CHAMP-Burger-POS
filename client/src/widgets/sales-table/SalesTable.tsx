import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Eye, Receipt, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useSalesList } from "@/entities/report/api";
import { formatPrice } from "@/entities/product/lib";
import { isDateFilterReady, type DateFilter, type SaleListItem } from "@/entities/report/model";
import { SaleDetailDialog } from "@/features/sale-detail/SaleDetailDialog";
import { dateFnsLocale } from "@/shared/lib/dateLocale";
import { useDebouncedValue } from "@/shared/lib/useDebouncedValue";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Pagination } from "@/shared/ui/Pagination";
import { SkeletonTableRows } from "@/shared/ui/Skeleton";

const PAGE_SIZE = 10;

export function SalesTable({ filter }: { filter: DateFilter }) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const search = useDebouncedValue(searchInput);

  const { data, isLoading, isError } = useSalesList(filter, search, page, PAGE_SIZE);
  const rangeIncomplete = !isDateFilterReady(filter);

  // Filter/search change under the cashier's feet — always land back on page 1 for the new set.
  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  return (
    <div className="rounded-card bg-ink-card shadow-card">
      <div className="border-b border-ink-line p-4 sm:p-6">
        {!rangeIncomplete && data?.summary && (
          <div className="mb-4 grid grid-cols-3 gap-3 rounded-xl border border-ink-line bg-ink-soft p-3 text-center text-sm sm:text-left">
            <SummaryStat label={t("sale.summaryRevenue")} value={formatPrice(data.summary.revenue)} accent />
            <SummaryStat label={t("sale.summaryCount")} value={String(data.summary.count)} />
            <SummaryStat label={t("sale.summaryAverage")} value={formatPrice(data.summary.average)} />
          </div>
        )}

        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("sale.searchPlaceholder")}
            aria-label={t("sale.searchPlaceholder")}
            className="input pl-9"
          />
        </div>
      </div>

      {rangeIncomplete && (
        <p className="px-6 py-10 text-center text-sm text-white/40">{t("report.selectBothDates")}</p>
      )}
      {!rangeIncomplete && isLoading && <SkeletonTableRows rows={6} columns={5} />}
      {!rangeIncomplete && isError && (
        <p className="px-6 py-10 text-center text-sm text-danger-soft">{t("sale.loadError")}</p>
      )}
      {!rangeIncomplete && data && data.items.length === 0 && (
        <EmptyState
          icon={Receipt}
          title={searchInput ? t("common.noResultsTitle") : t("sale.emptyTitle")}
          description={searchInput ? t("common.noResultsDescription") : t("sale.emptyDescription")}
        />
      )}

      {!rangeIncomplete && data && data.items.length > 0 && (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-6 py-3 font-medium">{t("sale.columns.number")}</th>
                  <th className="px-6 py-3 font-medium">{t("sale.columns.table")}</th>
                  <th className="px-6 py-3 font-medium">{t("sale.columns.date")}</th>
                  <th className="px-6 py-3 font-medium">{t("sale.columns.seller")}</th>
                  <th className="px-6 py-3 font-medium">{t("sale.columns.items")}</th>
                  <th className="px-6 py-3 font-medium">{t("sale.columns.sum")}</th>
                  <th className="px-6 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line">
                {data.items.map((sale) => (
                  <tr key={sale.id} className="transition hover:bg-ink-soft/60">
                    <td className="px-6 py-3 font-medium text-white">{sale.receiptNumber}</td>
                    <td className="px-6 py-3 text-white/60">
                      {sale.tableNumber !== null ? t("table.numberShort", { number: sale.tableNumber }) : "—"}
                    </td>
                    <td className="px-6 py-3 text-white/60">{formatDateTime(sale.createdAt)}</td>
                    <td className="px-6 py-3 text-white/70">{sale.sellerName}</td>
                    <td className="px-6 py-3 text-white/60">{sale.itemCount}</td>
                    <td className="px-6 py-3 font-semibold text-champ">{formatPrice(sale.totalAmount)}</td>
                    <td className="px-6 py-3 text-right">
                      <DetailButton onClick={() => setDetailId(sale.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {data.items.map((sale) => (
              <MobileSaleCard key={sale.id} sale={sale} onView={() => setDetailId(sale.id)} />
            ))}
          </div>

          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}

      <SaleDetailDialog saleId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function formatDateTime(value: string): string {
  return format(new Date(value), "d MMM, HH:mm", { locale: dateFnsLocale() });
}

function SummaryStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className={`mt-0.5 font-bold ${accent ? "text-champ" : "text-white"}`}>{value}</p>
    </div>
  );
}

function DetailButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("sale.viewDetails")}
      className="rounded-lg p-2.5 text-white/50 transition hover:bg-ink-line hover:text-white"
    >
      <Eye className="h-4 w-4" />
    </button>
  );
}

function MobileSaleCard({ sale, onView }: { sale: SaleListItem; onView: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onView}
      className="flex w-full items-center justify-between rounded-xl border border-ink-line bg-ink-soft p-3 text-left"
    >
      <div>
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-white">{sale.receiptNumber}</p>
          {sale.tableNumber !== null && (
            <span className="rounded-md bg-champ/15 px-1.5 py-0.5 text-[11px] font-bold text-champ">
              {t("table.numberShort", { number: sale.tableNumber })}
            </span>
          )}
        </div>
        <p className="text-xs text-white/40">
          {formatDateTime(sale.createdAt)} · {sale.sellerName}
        </p>
        <p className="text-xs text-white/30">{t("pos.itemsCount", { count: sale.itemCount })}</p>
      </div>
      <p className="text-sm font-semibold text-champ">{formatPrice(sale.totalAmount)}</p>
    </button>
  );
}
