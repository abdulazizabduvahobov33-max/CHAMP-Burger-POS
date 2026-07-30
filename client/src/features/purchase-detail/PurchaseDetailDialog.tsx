import { format } from "date-fns";
import { useTranslation } from "react-i18next";

import { usePurchase } from "@/entities/purchase/api";
import { UNIT_LABELS } from "@/entities/ingredient/model";
import { formatPrice } from "@/entities/product/lib";
import { dateFnsLocale } from "@/shared/lib/dateLocale";
import { Dialog } from "@/shared/ui/Dialog";
import { Skeleton, SkeletonTableRows } from "@/shared/ui/Skeleton";

type PurchaseDetailDialogProps = {
  purchaseId: string | null;
  onClose: () => void;
};

export function PurchaseDetailDialog({ purchaseId, onClose }: PurchaseDetailDialogProps) {
  const { t } = useTranslation();
  const { data: purchase, isLoading } = usePurchase(purchaseId);

  return (
    <Dialog open={purchaseId !== null} onClose={onClose} title={t("purchase.detailTitle")} widthClassName="max-w-lg">
      {isLoading && (
        <div>
          <Skeleton className="mb-2 h-4 w-1/2" />
          <Skeleton className="mb-4 h-4 w-1/3" />
          <div className="overflow-hidden rounded-xl border border-ink-line">
            <SkeletonTableRows rows={3} columns={4} />
          </div>
        </div>
      )}

      {purchase && (
        <div>
          <p className="mb-1 text-sm text-white/50">
            {format(new Date(purchase.purchaseDate), "d MMMM yyyy, HH:mm", { locale: dateFnsLocale() })} · {purchase.createdByName}
          </p>
          <p className="mb-4 text-sm text-white/70">
            {purchase.supplierName ?? t("purchase.supplierNotSpecified")}
            {purchase.note && <span className="text-white/40"> · {purchase.note}</span>}
          </p>

          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-ink-line">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-ink-soft text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("purchase.columns.ingredient")}</th>
                  <th className="px-4 py-2 font-medium">{t("purchase.columns.packs")}</th>
                  <th className="px-4 py-2 font-medium">{t("purchase.total")}</th>
                  <th className="px-4 py-2 font-medium">{t("purchase.detail.sum")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line">
                {purchase.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2">
                      <p className="text-white">{item.ingredientName}</p>
                      <p className="text-xs text-white/40">
                        {t("purchase.detail.perPackInfo", {
                          price: formatPrice(item.packPrice),
                          units: item.unitsPerPack,
                          unit: t(UNIT_LABELS[item.unit]),
                        })}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-white/70">{item.packQuantity}</td>
                    <td className="px-4 py-2 text-white/70">
                      {item.totalUnits} {t(UNIT_LABELS[item.unit])}
                    </td>
                    <td className="px-4 py-2 font-semibold text-champ">{formatPrice(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-lg font-bold">
            <span className="text-white/60">{t("purchase.total")}</span>
            <span className="text-champ">{formatPrice(purchase.totalCost)}</span>
          </div>
        </div>
      )}
    </Dialog>
  );
}
