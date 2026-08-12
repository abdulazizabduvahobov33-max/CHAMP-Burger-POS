import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Receipt } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useMySales } from "@/entities/sale/api";
import { formatPrice } from "@/entities/product/lib";
import { SaleHistoryDetailDialog } from "@/features/sale-history/SaleHistoryDetailDialog";
import { dateFnsLocale } from "@/shared/lib/dateLocale";
import { BrandMark } from "@/shared/ui/BrandMark";
import { EmptyState } from "@/shared/ui/EmptyState";
import { HeaderOverflowMenu } from "@/shared/ui/HeaderOverflowMenu";
import { LanguageSwitcher } from "@/shared/ui/LanguageSwitcher";
import { Pagination } from "@/shared/ui/Pagination";
import { Skeleton } from "@/shared/ui/Skeleton";
import { ThemeToggleButton } from "@/shared/ui/ThemeToggleButton";

const PAGE_SIZE = 20;

export default function SellerHistoryPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, isLoading } = useMySales(page, PAGE_SIZE);

  return (
    <div className="min-h-full [padding-top:max(0,env(safe-area-inset-top))] [padding-left:max(0,env(safe-area-inset-left))] [padding-right:max(0,env(safe-area-inset-right))]">
      <header className="flex flex-wrap items-center justify-between gap-y-2 border-b border-ink-line bg-ink px-4 py-3 sm:px-6 [padding-top:max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <BrandMark size={28} />
          <div className="flex items-center gap-2">
            <Link
              to="/pos"
              className="rounded-lg p-2 text-white/40 transition hover:bg-ink-soft hover:text-white"
              aria-label={t("history.backToPos")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">{t("history.title")}</h1>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <HeaderOverflowMenu>
            <ThemeToggleButton />
            <LanguageSwitcher />
          </HeaderOverflowMenu>
        </div>
      </header>

      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && data && data.items.length === 0 && (
          <EmptyState icon={Receipt} title={t("history.emptyTitle")} description={t("history.emptyDescription")} />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <>
            <div className="space-y-2.5">
              {data.items.map((sale) => (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => setDetailId(sale.id)}
                  className="flex w-full animate-fade-in items-center justify-between gap-3 rounded-xl border border-ink-line bg-ink-card p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-champ/40 hover:shadow-card-hover active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-champ/10 text-champ">
                      <Receipt className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-white">{sale.receiptNumber}</p>
                        {sale.tableNumber !== null && (
                          <span className="rounded-md bg-champ/15 px-1.5 py-0.5 text-[11px] font-bold text-champ">
                            {t("table.numberShort", { number: sale.tableNumber })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40">
                        {format(new Date(sale.createdAt), "d MMM, HH:mm", { locale: dateFnsLocale() })} ·{" "}
                        {t("pos.itemsCount", { count: sale.itemCount })}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-lg font-bold text-champ">{formatPrice(sale.totalAmount)}</span>
                    {sale.status === "PENDING" && (
                      <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold text-warn">
                        {t("sale.statusPending")}
                      </span>
                    )}
                    {sale.status === "REJECTED" && (
                      <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-bold text-danger-soft">
                        {t("sale.statusRejected")}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-2 rounded-xl border border-ink-line bg-ink-card">
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <SaleHistoryDetailDialog saleId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
