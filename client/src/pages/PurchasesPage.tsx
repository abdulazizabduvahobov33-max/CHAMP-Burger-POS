import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LogoutButton } from "@/features/auth/LogoutButton";
import { LanguageSwitcher } from "@/shared/ui/LanguageSwitcher";
import { ThemeToggleButton } from "@/shared/ui/ThemeToggleButton";
import { BrandMark } from "@/shared/ui/BrandMark";
import { DateRangeFilter } from "@/features/report-date-filter/DateRangeFilter";
import { PurchaseCreateDialog } from "@/features/purchase-create/PurchaseCreateDialog";
import { SupplierManageDialog } from "@/features/supplier-manage/SupplierManageDialog";
import type { DateFilter } from "@/entities/report/model";
import { PurchasesTable } from "@/widgets/purchases-table/PurchasesTable";

export default function PurchasesPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<DateFilter>({ preset: "month" });
  const [createOpen, setCreateOpen] = useState(false);
  const [suppliersOpen, setSuppliersOpen] = useState(false);

  return (
    <div className="min-h-full p-6 [padding-top:max(1.5rem,env(safe-area-inset-top))] [padding-left:max(1.5rem,env(safe-area-inset-left))] [padding-right:max(1.5rem,env(safe-area-inset-right))] [padding-bottom:max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BrandMark size={28} />
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="rounded-lg p-2 text-white/40 transition hover:bg-ink-soft hover:text-white"
              aria-label={t("common.backToAdminAria")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-bold tracking-tight">{t("dashboard.sections.purchases.title")}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggleButton />
          <LanguageSwitcher />
          <LogoutButton />
        </div>
      </header>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DateRangeFilter value={filter} onChange={setFilter} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSuppliersOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-ink-line px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white"
            >
              <Truck className="h-4 w-4" />
              {t("supplier.title")}
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-champ px-4 py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover"
            >
              <Plus className="h-4 w-4" />
              {t("purchase.createTitle")}
            </button>
          </div>
        </div>

        <PurchasesTable filter={filter} />
      </div>

      <PurchaseCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <SupplierManageDialog open={suppliersOpen} onClose={() => setSuppliersOpen(false)} />
    </div>
  );
}
