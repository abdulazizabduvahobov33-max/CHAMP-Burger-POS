import { useState } from "react";
import { format } from "date-fns";
import { History } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useIngredientMovements } from "@/entities/ingredient/api";
import { MOVEMENT_REASON_LABELS, UNIT_LABELS, type Ingredient } from "@/entities/ingredient/model";
import { dateFnsLocale } from "@/shared/lib/dateLocale";
import { Dialog } from "@/shared/ui/Dialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Pagination } from "@/shared/ui/Pagination";
import { SkeletonTableRows } from "@/shared/ui/Skeleton";

type MovementsDialogProps = {
  open: boolean;
  onClose: () => void;
  ingredient: Ingredient | null;
};

export function MovementsDialog({ open, onClose, ingredient }: MovementsDialogProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useIngredientMovements(ingredient?.id ?? "", page, { enabled: open && !!ingredient });

  if (!ingredient) return null;

  return (
    <Dialog
      open={open}
      onClose={() => {
        setPage(1);
        onClose();
      }}
      title={t("warehouse.movementsTitle", { name: ingredient.name })}
      widthClassName="max-w-2xl"
    >
      {isLoading && (
        <div className="overflow-hidden rounded-xl border border-ink-line">
          <SkeletonTableRows rows={4} columns={6} />
        </div>
      )}

      {!isLoading && data?.items.length === 0 && <EmptyState compact icon={History} title={t("warehouse.movementsEmpty")} />}

      {!isLoading && data && data.items.length > 0 && (
        <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-ink-line">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-ink-soft text-xs uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-4 py-2 font-medium">{t("warehouse.movementsColumns.date")}</th>
                <th className="px-4 py-2 font-medium">{t("warehouse.movementsColumns.type")}</th>
                <th className="px-4 py-2 font-medium">{t("warehouse.movementsColumns.change")}</th>
                <th className="px-4 py-2 font-medium">{t("warehouse.movementsColumns.balance")}</th>
                <th className="px-4 py-2 font-medium">{t("warehouse.movementsColumns.who")}</th>
                <th className="px-4 py-2 font-medium">{t("warehouse.movementsColumns.comment")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {data.items.map((m) => {
                const positive = Number(m.change) > 0;
                return (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-white/70">
                      {format(new Date(m.createdAt), "d MMM, HH:mm", { locale: dateFnsLocale() })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-white/70">
                      {t(MOVEMENT_REASON_LABELS[m.reason])}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-2 font-semibold ${positive ? "text-success" : "text-danger-soft"}`}>
                      {positive ? "+" : ""}
                      {m.change} {t(UNIT_LABELS[ingredient.unit])}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-white/50">
                      {m.quantityBefore !== null && m.quantityAfter !== null
                        ? `${m.quantityBefore} → ${m.quantityAfter}`
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-white/70">{m.createdByName}</td>
                    <td className="px-4 py-2 text-white/50">{m.note ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
    </Dialog>
  );
}
