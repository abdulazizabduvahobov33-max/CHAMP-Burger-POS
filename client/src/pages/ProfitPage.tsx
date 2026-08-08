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
import { useProfitSummary } from "@/entities/report/api";
import { formatPrice, profitColorClass } from "@/entities/product/lib";
import { isDateFilterReady, type DateFilter } from "@/entities/report/model";
import { ProductProfitabilityTable } from "@/widgets/product-profitability/ProductProfitabilityTable";
import { IngredientAnalyticsTable } from "@/widgets/ingredient-analytics/IngredientAnalyticsTable";

export default function ProfitPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<DateFilter>({ preset: "month" });

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
            <h1 className="text-xl font-bold tracking-tight">{t("dashboard.sections.profit.title")}</h1>
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
        <DateRangeFilter value={filter} onChange={setFilter} />

        <ProfitSummaryStrip filter={filter} />

        <ProductProfitabilityTable filter={filter} />
        <IngredientAnalyticsTable filter={filter} />
      </div>
    </div>
  );
}

function ProfitSummaryStrip({ filter }: { filter: DateFilter }) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useProfitSummary(filter);
  const rangeIncomplete = !isDateFilterReady(filter);

  if (rangeIncomplete) {
    return (
      <p className="rounded-card bg-ink-card p-4 text-center text-sm text-white/40 shadow-card">
        {t("report.selectBothDates")}
      </p>
    );
  }

  if (isError) {
    return (
      <p role="alert" className="rounded-card bg-ink-card p-4 text-center text-sm text-danger-soft shadow-card">
        {t("profit.loadError")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <StatCard label={t("profit.columns.revenue")} value={data ? formatPrice(data.revenue) : undefined} isLoading={isLoading} />
      <StatCard label={t("profit.columns.cost")} value={data ? formatPrice(data.cost) : undefined} isLoading={isLoading} />
      <StatCard
        label={t("profit.columns.profit")}
        value={data ? formatPrice(data.profit) : undefined}
        isLoading={isLoading}
        accentClass={data ? profitColorClass(data.profit) : undefined}
      />
      <StatCard label={t("profit.columns.margin")} value={data ? `${data.margin}%` : undefined} isLoading={isLoading} />
      <StatCard label={t("profit.averageProfit")} value={data ? formatPrice(data.averageProfit) : undefined} isLoading={isLoading} />
    </div>
  );
}

function StatCard({
  label,
  value,
  isLoading,
  accentClass,
}: {
  label: string;
  value?: string;
  isLoading: boolean;
  accentClass?: string;
}) {
  return (
    <div className="rounded-card bg-ink-card p-4 shadow-card sm:p-5">
      <p className="truncate text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className={`mt-2 text-xl font-bold sm:text-2xl ${accentClass ?? "text-white"}`}>{isLoading ? "вЂ¦" : value}</p>
    </div>
  );
}
