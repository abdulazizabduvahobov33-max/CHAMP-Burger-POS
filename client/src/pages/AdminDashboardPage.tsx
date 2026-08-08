import { Link } from "react-router-dom";
import { AlertTriangle, BarChart3, Bot, Receipt, Settings, ShoppingBasket, TrendingUp, Truck, Users, Warehouse, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useDashboardSummary } from "@/entities/report/api";
import { useIngredients } from "@/entities/ingredient/api";
import { formatPrice, profitColorClass } from "@/entities/product/lib";
import { ChangePasswordButton } from "@/features/change-password/ChangePasswordButton";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { HeaderOverflowMenu } from "@/shared/ui/HeaderOverflowMenu";
import { LanguageSwitcher } from "@/shared/ui/LanguageSwitcher";
import { ThemeToggleButton } from "@/shared/ui/ThemeToggleButton";
import { BrandMark } from "@/shared/ui/BrandMark";
import { Skeleton } from "@/shared/ui/Skeleton";
import { useAuthStore } from "@/shared/stores/authStore";

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: lowStock, isLoading: lowStockLoading } = useIngredients({ lowStock: true, page: 1, pageSize: 1 });

  return (
    <div className="min-h-full p-6 [padding-top:max(1.5rem,env(safe-area-inset-top))] [padding-left:max(1.5rem,env(safe-area-inset-left))] [padding-right:max(1.5rem,env(safe-area-inset-right))] [padding-bottom:max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BrandMark size={32} />
          <h1 className="text-xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <HeaderOverflowMenu>
            <ChangePasswordButton />
            <ThemeToggleButton />
            <LanguageSwitcher />
          </HeaderOverflowMenu>
          <LogoutButton />
        </div>
      </header>

      <div className="animate-fade-in rounded-card bg-gradient-to-br from-champ/10 via-ink-card to-ink-card p-6 shadow-card">
        <p className="text-white/70">
          {t("dashboard.welcome")}, <span className="font-semibold text-white">{user?.name}</span>
        </p>
        <p className="mt-1 text-sm text-white/40">
          {t("dashboard.role")}: {t("user.role.SUPER_ADMIN")}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={Receipt}
          label={t("dashboard.salesToday")}
          value={summary ? formatPrice(summary.today.revenue) : undefined}
          sublabel={summary ? t("dashboard.receiptsSuffix", { count: summary.today.count }) : undefined}
          isLoading={summaryLoading}
        />
        <KpiCard
          icon={TrendingUp}
          label={t("dashboard.profitToday")}
          value={summary ? formatPrice(summary.today.profit) : undefined}
          isLoading={summaryLoading}
          valueClass={summary ? profitColorClass(summary.today.profit) : undefined}
        />
        <KpiCard
          icon={BarChart3}
          label={t("dashboard.averageReceipt")}
          value={summary ? formatPrice(summary.averageReceipt) : undefined}
          isLoading={summaryLoading}
        />
        <KpiCard
          to="/admin/warehouse"
          icon={AlertTriangle}
          label={t("dashboard.lowStock")}
          value={lowStock ? String(lowStock.total) : undefined}
          isLoading={lowStockLoading}
          valueClass={lowStock && lowStock.total > 0 ? "text-warn" : "text-success"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard to="/admin/reports" icon={BarChart3} title={t("dashboard.sections.reports.title")} subtitle={t("dashboard.sections.reports.subtitle")} />
        <DashboardCard to="/admin/products" icon={ShoppingBasket} title={t("dashboard.sections.products.title")} subtitle={t("dashboard.sections.products.subtitle")} />
        <DashboardCard to="/admin/warehouse" icon={Warehouse} title={t("dashboard.sections.warehouse.title")} subtitle={t("dashboard.sections.warehouse.subtitle")} />
        <DashboardCard to="/admin/purchases" icon={Truck} title={t("dashboard.sections.purchases.title")} subtitle={t("dashboard.sections.purchases.subtitle")} />
        <DashboardCard to="/admin/profit" icon={TrendingUp} title={t("dashboard.sections.profit.title")} subtitle={t("dashboard.sections.profit.subtitle")} />
        <DashboardCard to="/admin/users" icon={Users} title={t("dashboard.sections.users.title")} subtitle={t("dashboard.sections.users.subtitle")} />
        <DashboardCard to="/admin/settings" icon={Settings} title={t("dashboard.sections.settings.title")} subtitle={t("dashboard.sections.settings.subtitle")} />
        <DashboardCard to="/admin/ai" icon={Bot} title={t("dashboard.sections.ai.title")} subtitle={t("dashboard.sections.ai.subtitle")} badge={t("ai.localModeBadge")} />
      </div>
    </div>
  );
}

function KpiCard({
  to,
  icon: Icon,
  label,
  value,
  sublabel,
  isLoading,
  valueClass,
}: {
  to?: string;
  icon: LucideIcon;
  label: string;
  value?: string;
  sublabel?: string;
  isLoading: boolean;
  valueClass?: string;
}) {
  const content = isLoading ? (
    <>
      <Skeleton className="h-4 w-4" />
      <Skeleton className="mt-3 h-6 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </>
  ) : (
    <>
      <Icon className="h-4 w-4 text-champ" />
      <p className={`mt-2 truncate text-lg font-extrabold sm:text-xl ${valueClass ?? "text-white"}`}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-white/40">{label}</p>
      {sublabel && <p className="truncate text-[11px] text-white/25">{sublabel}</p>}
    </>
  );

  const className =
    "animate-fade-in rounded-card bg-ink-card p-4 shadow-card transition duration-200 hover:shadow-card-hover sm:p-5" +
    (to ? " block hover:-translate-y-0.5" : "");

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

function DashboardCard({
  to,
  icon: Icon,
  title,
  subtitle,
  badge,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <Link
      to={to}
      className="group flex animate-fade-in items-center gap-4 rounded-card border border-transparent bg-ink-card p-6 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-champ/30 hover:shadow-card-hover"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-champ/15 text-champ transition-transform duration-200 group-hover:scale-110">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-white">{title}</p>
          {badge && (
            <span className="inline-flex items-center rounded-full bg-champ/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-champ">
              {badge}
            </span>
          )}
        </div>
        <p className="text-sm text-white/40">{subtitle}</p>
      </div>
    </Link>
  );
}
