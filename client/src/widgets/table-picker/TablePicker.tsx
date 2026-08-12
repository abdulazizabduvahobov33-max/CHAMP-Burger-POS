import { LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTables } from "@/entities/table/api";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Skeleton } from "@/shared/ui/Skeleton";

/**
 * Big-button table grid, reused by the waiter's mandatory pre-order gate (SellerPosPage) and the
 * admin's optional register selector (AdminPosPage) — one component, two call sites, so a future
 * change to how tables are picked (e.g. showing occupied/free status) is made once. Only shows
 * ACTIVE tables — a table an admin has switched off shouldn't be selectable for a new order.
 */
export function TablePicker({ selectedTableId, onSelect }: { selectedTableId: string | null; onSelect: (tableId: string) => void }) {
  const { t } = useTranslation();
  const { data: tables, isLoading } = useTables();
  const activeTables = tables?.filter((table) => table.isActive) ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl sm:h-24" />
        ))}
      </div>
    );
  }

  if (activeTables.length === 0) {
    return <EmptyState icon={LayoutGrid} title={t("table.pickerEmptyTitle")} description={t("table.pickerEmptyDescription")} />;
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {activeTables
        .slice()
        .sort((a, b) => a.number - b.number)
        .map((table) => {
          const selected = table.id === selectedTableId;
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => onSelect(table.id)}
              className={`flex h-20 flex-col items-center justify-center gap-0.5 rounded-2xl text-lg font-extrabold transition active:scale-95 sm:h-24 sm:text-xl ${
                selected
                  ? "bg-champ text-onaccent shadow-card-hover"
                  : "bg-ink-card text-white shadow-card hover:-translate-y-0.5 hover:shadow-card-hover"
              }`}
            >
              <span className="text-[11px] font-medium uppercase tracking-wide opacity-70">{t("table.numberLabel")}</span>
              <span>{table.number}</span>
            </button>
          );
        })}
    </div>
  );
}
