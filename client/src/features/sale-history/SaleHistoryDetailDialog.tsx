import { format } from "date-fns";
import { Printer } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useMySaleDetail } from "@/entities/sale/api";
import { formatPrice } from "@/entities/product/lib";
import { dateFnsLocale } from "@/shared/lib/dateLocale";
import { usePrintReceipt } from "@/shared/printing/usePrintReceipt";
import { toast } from "@/shared/stores/toastStore";
import { Dialog } from "@/shared/ui/Dialog";
import { Skeleton, SkeletonTableRows } from "@/shared/ui/Skeleton";

type SaleHistoryDetailDialogProps = {
  saleId: string | null;
  onClose: () => void;
};

/** Seller-facing receipt view — deliberately lighter than admin's SaleDetailDialog (no cost/
 * profit columns, which are business-sensitive figures a cashier has no need to see), but adds
 * the cash received / change lines a receipt conventionally carries. */
export function SaleHistoryDetailDialog({ saleId, onClose }: SaleHistoryDetailDialogProps) {
  const { t } = useTranslation();
  const { data: sale, isLoading } = useMySaleDetail(saleId);
  const { printReceipt } = usePrintReceipt();

  async function handlePrint() {
    if (!sale) return;
    const result = await printReceipt(sale);
    toast[result.ok ? "success" : "error"](t(result.ok ? "printing.printed" : "printing.printFailed"));
  }

  return (
    <Dialog
      open={saleId !== null}
      onClose={onClose}
      title={sale ? t("sale.detailTitle", { number: sale.receiptNumber }) : t("sale.detailTitleDefault")}
      widthClassName="max-w-md"
    >
      {isLoading && (
        <div>
          <Skeleton className="mb-4 h-4 w-1/2" />
          <div className="overflow-hidden rounded-xl border border-ink-line">
            <SkeletonTableRows rows={3} columns={3} />
          </div>
        </div>
      )}

      {sale && (
        <div>
          <p className="mb-4 text-sm text-white/50">
            {format(new Date(sale.createdAt), "d MMMM yyyy, HH:mm", { locale: dateFnsLocale() })}
          </p>

          <div className="space-y-2 rounded-xl border border-ink-line p-3">
            {sale.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-white">{item.productName}</p>
                  <p className="text-xs text-white/40">
                    {item.variantLabel} × {item.quantity}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-champ">{formatPrice(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-ink-line pt-3">
            <div className="flex items-center justify-between text-lg font-bold">
              <span className="text-white/60">{t("sale.total")}</span>
              <span className="text-champ">{formatPrice(sale.totalAmount)}</span>
            </div>
            {sale.cashReceived && (
              <div className="flex items-center justify-between text-sm text-white/50">
                <span>{t("pos.payment.received")}</span>
                <span>{formatPrice(sale.cashReceived)}</span>
              </div>
            )}
            {sale.changeGiven && (
              <div className="flex items-center justify-between text-sm text-white/50">
                <span>{t("pos.payment.change")}</span>
                <span>{formatPrice(sale.changeGiven)}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-ink-line py-3 text-sm font-bold text-white/70 transition hover:border-champ/50 hover:text-white"
          >
            <Printer className="h-4 w-4" />
            {t("printing.print")}
          </button>
        </div>
      )}
    </Dialog>
  );
}
