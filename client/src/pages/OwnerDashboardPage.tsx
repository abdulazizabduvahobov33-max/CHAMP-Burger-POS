import { useState } from "react";
import { format } from "date-fns";
import { Receipt, Search, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useOwnerSales } from "@/entities/owner/api";
import type { OwnerSaleListItem } from "@/entities/owner/model";
import { usePendingSales } from "@/entities/sale/api";
import { formatPrice } from "@/entities/product/lib";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { OwnerSaleDetailDialog } from "@/widgets/owner-sale-detail/OwnerSaleDetailDialog";
import { PendingOrdersPanel } from "@/widgets/pending-orders/PendingOrdersPanel";
import { dateFnsLocale } from "@/shared/lib/dateLocale";
import { useDebouncedValue } from "@/shared/lib/useDebouncedValue";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Pagination } from "@/shared/ui/Pagination";
import { SkeletonTableRows } from "@/shared/ui/Skeleton";

const PAGE_SIZE = 20;

/**
 * The owner's own, separate dashboard — reachable only via /owner after logging in with the
 * owner account (see OwnerLoginPage.tsx). Deliberately narrow: no products/warehouse/reports,
 * just the two things the module spec calls for — deciding on pending orders the cashier can no
 * longer decline themselves, and correcting an already-finalized sale with a permanent audit
 * trail instead of ever deleting anything (see owner.service.ts).
 */
export default function OwnerDashboardPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const search = useDebouncedValue(searchInput);

  const { data, isLoading } = useOwnerSales(page, PAGE_SIZE, search);
  const { data: pending } = usePendingSales();

  return (
    <div className="min-h-full p-6 [padding-top:max(1.5rem,env(safe-area-inset-top))] [padding-left:max(1.5rem,env(safe-area-inset-left))] [padding-right:max(1.5rem,env(safe-area-inset-right))] [padding-bottom:max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/60">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">{t("owner.dashboardTitle")}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPendingOpen(true)}
            className="relative flex items-center gap-2 rounded-xl border border-ink-line px-3.5 py-2 text-sm font-medium text-white/70 transition hover:text-white"
          >
            {t("owner.pendingButton")}
            {pending && pending.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-champ px-1 text-[11px] font-bold text-onaccent">
                {pending.length}
              </span>
            )}
          </button>
          <LogoutButton />
        </div>
      </header>

      <p className="mb-4 text-sm text-white/40">{t("owner.dashboardDescription")}</p>

      <div className="rounded-card bg-ink-card shadow-card">
        <div className="border-b border-ink-line p-4 sm:p-6">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              placeholder={t("sale.searchPlaceholder")}
              aria-label={t("sale.searchPlaceholder")}
              className="input pl-9"
            />
          </div>
        </div>

        {isLoading && <SkeletonTableRows rows={6} columns={5} />}

        {!isLoading && data && data.items.length === 0 && (
          <EmptyState
            icon={Receipt}
            title={searchInput ? t("common.noResultsTitle") : t("owner.emptyTitle")}
            description={searchInput ? t("common.noResultsDescription") : t("owner.emptyDescription")}
          />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-white/40">
                  <tr>
                    <th className="px-6 py-3 font-medium">{t("sale.columns.number")}</th>
                    <th className="px-6 py-3 font-medium">{t("sale.columns.table")}</th>
                    <th className="px-6 py-3 font-medium">{t("sale.columns.date")}</th>
                    <th className="px-6 py-3 font-medium">{t("sale.columns.seller")}</th>
                    <th className="px-6 py-3 font-medium">{t("sale.columns.sum")}</th>
                    <th className="px-6 py-3 font-medium">{t("owner.columns.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-line">
                  {data.items.map((sale) => (
                    <tr
                      key={sale.id}
                      onClick={() => setDetailId(sale.id)}
                      className="cursor-pointer transition hover:bg-ink-soft/60"
                    >
                      <td className="px-6 py-3 font-medium text-white">{sale.receiptNumber}</td>
                      <td className="px-6 py-3 text-white/60">
                        {sale.tableNumber !== null ? t("table.numberShort", { number: sale.tableNumber }) : "—"}
                      </td>
                      <td className="px-6 py-3 text-white/60">{formatDateTime(sale.createdAt)}</td>
                      <td className="px-6 py-3 text-white/70">{sale.sellerName}</td>
                      <td className="px-6 py-3 font-semibold text-champ">{formatPrice(sale.totalAmount)}</td>
                      <td className="px-6 py-3">
                        <StatusBadge status={sale.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {data.items.map((sale) => (
                <MobileSaleCard key={sale.id} sale={sale} onClick={() => setDetailId(sale.id)} />
              ))}
            </div>

            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
          </>
        )}
      </div>

      <OwnerSaleDetailDialog saleId={detailId} onClose={() => setDetailId(null)} />
      <PendingOrdersPanel open={pendingOpen} onClose={() => setPendingOpen(false)} canReject />
    </div>
  );
}

function formatDateTime(value: string): string {
  return format(new Date(value), "d MMM, HH:mm", { locale: dateFnsLocale() });
}

function StatusBadge({ status }: { status: OwnerSaleListItem["status"] }) {
  const { t } = useTranslation();
  if (status === "CANCELLED") {
    return (
      <span className="rounded-full bg-danger/15 px-2.5 py-1 text-xs font-bold text-danger-soft">
        {t("sale.statusCancelled")}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
      {t("owner.statusAccepted")}
    </span>
  );
}

function MobileSaleCard({ sale, onClick }: { sale: OwnerSaleListItem; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
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
      </div>
      <div className="flex flex-col items-end gap-1">
        <p className="text-sm font-semibold text-champ">{formatPrice(sale.totalAmount)}</p>
        <StatusBadge status={sale.status} />
      </div>
    </button>
  );
}
