import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LogoutButton } from "@/features/auth/LogoutButton";
import { HeaderOverflowMenu } from "@/shared/ui/HeaderOverflowMenu";
import { LanguageSwitcher } from "@/shared/ui/LanguageSwitcher";
import { ThemeToggleButton } from "@/shared/ui/ThemeToggleButton";
import { BrandMark } from "@/shared/ui/BrandMark";
import { StockIntakeGrid } from "@/widgets/stock-intake/StockIntakeGrid";

export default function StockIntakePage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-full p-6 [padding-top:max(1.5rem,env(safe-area-inset-top))] [padding-left:max(1.5rem,env(safe-area-inset-left))] [padding-right:max(1.5rem,env(safe-area-inset-right))] [padding-bottom:max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BrandMark size={28} />
          <div>
            <div className="flex items-center gap-2">
              <Link
                to="/admin"
                className="rounded-lg p-2 text-white/40 transition hover:bg-ink-soft hover:text-white"
                aria-label={t("common.backToAdminAria")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-xl font-bold tracking-tight">{t("dashboard.sections.intake.title")}</h1>
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/admin/warehouse"
            className="flex items-center gap-1.5 rounded-xl border border-ink-line px-3 py-2 text-sm font-medium text-white/70 transition hover:text-white"
          >
            <BookOpen className="h-4 w-4" />
            {t("intake.backToDirectory")}
          </Link>
          <HeaderOverflowMenu>
            <ThemeToggleButton />
            <LanguageSwitcher />
          </HeaderOverflowMenu>
          <LogoutButton />
        </div>
      </header>

      <StockIntakeGrid />
    </div>
  );
}
