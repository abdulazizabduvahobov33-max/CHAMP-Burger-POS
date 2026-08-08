import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LogoutButton } from "@/features/auth/LogoutButton";
import { HeaderOverflowMenu } from "@/shared/ui/HeaderOverflowMenu";
import { LanguageSwitcher } from "@/shared/ui/LanguageSwitcher";
import { ThemeToggleButton } from "@/shared/ui/ThemeToggleButton";
import { BrandMark } from "@/shared/ui/BrandMark";
import { DateRangeFilter } from "@/features/report-date-filter/DateRangeFilter";
import type { DateFilter } from "@/entities/report/model";
import { DashboardStats } from "@/widgets/reports-dashboard/DashboardStats";
import { SalesTable } from "@/widgets/sales-table/SalesTable";
import { TopProductsList } from "@/widgets/top-products/TopProductsList";
import { LowStockList } from "@/widgets/low-stock/LowStockList";

export default function ReportsPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<DateFilter>({ preset: "today" });

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
            <h1 className="text-xl font-bold tracking-tight">{t("dashboard.sections.reports.title")}</h1>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <HeaderOverflowMenu>
            <ThemeToggleButton />
            <LanguageSwitcher />
          </HeaderOverflowMenu>
          <LogoutButton />
        </div>
      </header>

      <div className="space-y-6">
        <DashboardStats />

        <DateRangeFilter value={filter} onChange={setFilter} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SalesTable filter={filter} />
          </div>
          <div className="space-y-6">
            <TopProductsList filter={filter} />
            <LowStockList />
          </div>
        </div>
      </div>
    </div>
  );
}
