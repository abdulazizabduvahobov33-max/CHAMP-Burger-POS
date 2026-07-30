import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Eye, Search, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePurchases } from "@/entities/purchase/api";
import type { PurchaseListItem } from "@/entities/purchase/model";
import { formatPrice } from "@/entities/product/lib";
import { isDateFilterReady, type DateFilter } from "@/entities/report/model";
import { useSuppliers } from "@/entities/supplier/api";
import { PurchaseDetailDialog } from "@/features/purchase-detail/PurchaseDetailDialog";
import { dateFnsLocale } from "@/shared/lib/dateLocale";
import { useDebouncedValue } from "@/shared/lib/useDebouncedValue";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Pagination } from "@/shared/ui/Pagination";
import { SkeletonTableRows } from "@/shared/ui/Skeleton";

const PAGE_SIZE = 10;

export function PurchasesTable({ filter }: { filter: DateFilter }) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const search = useDebouncedValue(searchInput);

  const { data: suppliers } = useSuppliers();
  const { data, isLoading, isError } = usePurchases(filter, search, supplierId, page, PAGE_SIZE);
  const rangeIncomplete = !isDateFilterReady(filter);

  useEffect(() => {
    setPage(1);
  }, [filter, search, supplierId]);

  return (
    <div className="rounded-card bg-ink-card shadow-card">
      <div className="border-b border-ink-line p-4 sm:p-6">
        {!rangeIncomplete && data?.summary && (
          <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-ink-line bg-ink-soft p-3 text-center text-sm sm:text-left">
            <SummaryStat label={t("purchase.summaryTotal")} value={formatPrice(data.summary.totalCost)} accent />
            <SummaryStat label={t("purchase.summaryCount")} value={String(data.summary.count)} />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("purchase.searchPlaceholder")}
              className="input pl-9"
            />
          </div>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input w-auto max-w-[12rem]">
            <option value="">{t("purchase.allSuppliers")}</option>
            {suppliers?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rangeIncomplete && <p className="px-6 py-10 text-center text-sm text-white/40">{t("report.selectBothDates")}</p>}
      {!rangeIncomplete && isLoading && <SkeletonTableRows rows={6} columns={4} />}
      {!rangeIncomplete && isError && (
        <p role="alert" className="px-6 py-10 text-center text-sm text-danger-soft">
          {t("purchase.loadError")}
        </p>
      )}
      {!rangeIncomplete && data && data.items.length === 0 && (
        <EmptyState
          icon={Truck}
          title={search || supplierId ? t("common.noResultsTitle") : t("purchase.emptyTitle")}
          description={search || supplierId ? t("common.noResultsDescription") : t("purchase.emptyDescription")}
        />
      )}

      {!rangeIncomplete && data && data.items.length > 0 && (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-6 py-3 font-medium">{t("purchase.columns.date")}</th>
                  <th className="px-6 py-3 font-medium">{t("purchase.supplier")}</th>
                  <th className="px-6 py-3 font-medium">{t("purchase.columns.itemCount")}</th>
                  <th className="px-6 py-3 font-medium">{t("purchase.detail.sum")}</th>
                  <th className="px-6 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line">
                {data.items.map((purchase) => (
                  <tr key={purchase.id} className="transition hover:bg-ink-soft/60">
                    <td className="px-6 py-3 text-white/60">{formatDateTime(purchase.purchaseDate)}</td>
                    <td className="px-6 py-3 text-white/70">{purchase.supplierName ?? "—"}</td>
                    <td className="px-6 py-3 text-white/60">{purchase.itemCount}</td>
                    <td className="px-6 py-3 font-semibold text-champ">{formatPrice(purchase.totalCost)}</td>
                    <td className="px-6 py-3 text-right">
                      <DetailButton onClick={() => setDetailId(purchase.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {data.items.map((purchase) => (
              <MobilePurchaseCard key={purchase.id} purchase={purchase} onView={() => setDetailId(purchase.id)} />
            ))}
          </div>

          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}

      <PurchaseDetailDialog purchaseId={detailId} onClose={() => setDetailId(null)} />
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
      aria-label={t("purchase.viewDetails")}
      className="rounded-lg p-2.5 text-white/50 transition hover:bg-ink-line hover:text-white"
    >
      <Eye className="h-4 w-4" />
    </button>
  );
}

function MobilePurchaseCard({ purchase, onView }: { purchase: PurchaseListItem; onView: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onView}
      className="flex w-full items-center justify-between rounded-xl border border-ink-line bg-ink-soft p-3 text-left"
    >
      <div>
        <p className="font-medium text-white">{purchase.supplierName ?? t("purchase.noSupplier")}</p>
        <p className="text-xs text-white/40">{formatDateTime(purchase.purchaseDate)}</p>
        <p className="text-xs text-white/30">{t("purchase.itemsCount", { count: purchase.itemCount })}</p>
      </div>
      <p className="text-sm font-semibold text-champ">{formatPrice(purchase.totalCost)}</p>
    </button>
  );
}
