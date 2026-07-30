import { useTranslation } from "react-i18next";

import { useDashboardSummary } from "@/entities/report/api";
import { formatPrice, profitColorClass } from "@/entities/product/lib";
import { SkeletonStatCard } from "@/shared/ui/Skeleton";

export function DashboardStats() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useDashboardSummary();

  if (isError) {
    return (
      <p role="alert" className="rounded-card bg-ink-card p-4 text-sm text-danger-soft shadow-card sm:p-5">
        {t("dashboard.statsLoadError")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label={t("dashboard.salesToday")}
          value={data ? formatPrice(data.today.revenue) : undefined}
          sublabel={data ? t("dashboard.receiptsSuffix", { count: data.today.count }) : undefined}
          isLoading={isLoading}
        />
        <StatCard
          label={t("dashboard.salesWeek")}
          value={data ? formatPrice(data.week.revenue) : undefined}
          sublabel={data ? t("dashboard.receiptsSuffix", { count: data.week.count }) : undefined}
          isLoading={isLoading}
        />
        <StatCard
          label={t("dashboard.salesMonth")}
          value={data ? formatPrice(data.month.revenue) : undefined}
          sublabel={data ? t("dashboard.receiptsSuffix", { count: data.month.count }) : undefined}
          isLoading={isLoading}
        />
        <StatCard label={t("dashboard.totalRevenue")} value={data ? formatPrice(data.totalRevenue) : undefined} isLoading={isLoading} accent="champ" />
        <StatCard label={t("dashboard.receiptCount")} value={data?.receiptCount.toString()} isLoading={isLoading} />
        <StatCard label={t("dashboard.averageReceipt")} value={data ? formatPrice(data.averageReceipt) : undefined} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t("dashboard.profitToday")}
          value={data ? formatPrice(data.today.profit) : undefined}
          isLoading={isLoading}
          accentClass={data ? profitColorClass(data.today.profit) : undefined}
        />
        <StatCard
          label={t("dashboard.profitWeek")}
          value={data ? formatPrice(data.week.profit) : undefined}
          isLoading={isLoading}
          accentClass={data ? profitColorClass(data.week.profit) : undefined}
        />
        <StatCard
          label={t("dashboard.profitMonth")}
          value={data ? formatPrice(data.month.profit) : undefined}
          isLoading={isLoading}
          accentClass={data ? profitColorClass(data.month.profit) : undefined}
        />
        <StatCard
          label={t("dashboard.totalProfit")}
          value={data ? formatPrice(data.totalProfit) : undefined}
          sublabel={data ? t("dashboard.marginSuffix", { margin: data.profitMargin }) : undefined}
          isLoading={isLoading}
          accentClass={data ? profitColorClass(data.totalProfit) : undefined}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  isLoading,
  accent,
  accentClass,
}: {
  label: string;
  value?: string;
  sublabel?: string;
  isLoading: boolean;
  accent?: "champ";
  accentClass?: string;
}) {
  if (isLoading) return <SkeletonStatCard />;

  const resolvedClass = accentClass ?? (accent === "champ" ? "text-champ" : "text-white");
  return (
    <div className="rounded-card bg-ink-card p-4 shadow-card transition duration-200 hover:shadow-card-hover sm:p-5">
      <p className="truncate text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className={`mt-2 text-xl font-bold sm:text-2xl ${resolvedClass}`}>{value}</p>
      {sublabel && <p className="mt-1 text-xs text-white/30">{sublabel}</p>}
    </div>
  );
}
