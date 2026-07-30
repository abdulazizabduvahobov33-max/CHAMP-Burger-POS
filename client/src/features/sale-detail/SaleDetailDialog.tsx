import { format } from "date-fns";
import { useTranslation } from "react-i18next";

import { useSaleDetail } from "@/entities/report/api";
import { formatPrice, profitColorClass } from "@/entities/product/lib";
import { dateFnsLocale } from "@/shared/lib/dateLocale";
import { Dialog } from "@/shared/ui/Dialog";
import { Skeleton, SkeletonTableRows } from "@/shared/ui/Skeleton";

type SaleDetailDialogProps = {
  saleId: string | null;
  onClose: () => void;
};

export function SaleDetailDialog({ saleId, onClose }: SaleDetailDialogProps) {
  const { t } = useTranslation();
  const { data: sale, isLoading } = useSaleDetail(saleId);

  return (
    <Dialog
      open={saleId !== null}
      onClose={onClose}
      title={sale ? t("sale.detailTitle", { number: sale.receiptNumber }) : t("sale.detailTitleDefault")}
      widthClassName="max-w-xl"
    >
      {isLoading && (
        <div>
          <Skeleton className="mb-4 h-4 w-1/2" />
          <div className="overflow-hidden rounded-xl border border-ink-line">
            <SkeletonTableRows rows={3} columns={6} />
          </div>
        </div>
      )}

      {sale && (
        <div>
          <p className="mb-4 text-sm text-white/50">
            {format(new Date(sale.createdAt), "d MMMM yyyy, HH:mm", { locale: dateFnsLocale() })} · {sale.sellerName}
          </p>

          <div className="max-h-[50vh] overflow-auto rounded-xl border border-ink-line">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="sticky top-0 bg-ink-soft text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("sale.columns.product")}</th>
                  <th className="px-4 py-2 font-medium">{t("sale.columns.quantity")}</th>
                  <th className="px-4 py-2 font-medium">{t("sale.columns.price")}</th>
                  <th className="px-4 py-2 font-medium">{t("sale.columns.sum")}</th>
                  <th className="px-4 py-2 font-medium">{t("sale.columns.cost")}</th>
                  <th className="px-4 py-2 font-medium">{t("sale.columns.profit")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line">
                {sale.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2">
                      <p className="text-white">{item.productName}</p>
                      <p className="text-xs text-white/40">{item.variantLabel}</p>
                    </td>
                    <td className="px-4 py-2 text-white/70">{item.quantity}</td>
                    <td className="px-4 py-2 text-white/70">{formatPrice(item.unitPrice)}</td>
                    <td className="px-4 py-2 font-semibold text-champ">{formatPrice(item.subtotal)}</td>
                    <td className="px-4 py-2 text-white/50">{item.hasCostData ? formatPrice(item.cost) : "—"}</td>
                    <td className={`px-4 py-2 font-semibold ${item.hasCostData ? profitColorClass(item.profit) : "text-white/50"}`}>
                      {item.hasCostData ? formatPrice(item.profit) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-sm text-white/50">
              <span>{t("sale.totalCost")}</span>
              <span>{formatPrice(sale.totalCost)}</span>
            </div>
            <div className={`flex items-center justify-between text-sm font-semibold ${profitColorClass(sale.totalProfit)}`}>
              <span>{t("sale.totalProfit")}</span>
              <span>{formatPrice(sale.totalProfit)}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-bold">
              <span className="text-white/60">{t("sale.total")}</span>
              <span className="text-champ">{formatPrice(sale.totalAmount)}</span>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
