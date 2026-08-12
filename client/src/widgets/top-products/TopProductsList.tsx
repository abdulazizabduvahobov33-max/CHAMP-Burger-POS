import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTopProducts } from "@/entities/report/api";
import { formatPrice, formatSaleQuantity } from "@/entities/product/lib";
import { isDateFilterReady, type DateFilter } from "@/entities/report/model";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Skeleton } from "@/shared/ui/Skeleton";

export function TopProductsList({ filter }: { filter: DateFilter }) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useTopProducts(filter, 10);
  const rangeIncomplete = !isDateFilterReady(filter);

  return (
    <div className="rounded-card bg-ink-card p-4 shadow-card sm:p-6">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-white/50">{t("dashboard.topProducts")}</h2>

      {rangeIncomplete && <p className="py-6 text-center text-sm text-white/40">{t("report.selectBothDates")}</p>}

      {!rangeIncomplete && isLoading && (
        <div className="divide-y divide-ink-line">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {!rangeIncomplete && isError && (
        <p className="py-6 text-center text-sm text-danger-soft">{t("dashboard.topProductsLoadError")}</p>
      )}

      {!rangeIncomplete && data && data.length === 0 && (
        <EmptyState compact icon={Trophy} title={t("dashboard.noSalesInPeriod")} />
      )}

      {!rangeIncomplete && data && data.length > 0 && (
        <div className="divide-y divide-ink-line">
          {data.map((product, index) => (
            <div key={product.variantId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-champ/15 text-xs font-bold text-champ">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{product.productName}</p>
                  {product.saleType !== "WEIGHT" && <p className="truncate text-xs text-white/40">{product.variantLabel}</p>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-champ">
                  {product.saleType === "WEIGHT"
                    ? formatSaleQuantity(product.quantitySold, product.saleType)
                    : t("dashboard.unitsSoldSuffix", { count: product.quantitySold })}
                </p>
                <p className="text-xs text-white/30">{formatPrice(product.revenue)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
