import { Link } from "react-router-dom";
import { Receipt } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ChangePasswordButton } from "@/features/change-password/ChangePasswordButton";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { LanguageSwitcher } from "@/shared/ui/LanguageSwitcher";
import { ThemeToggleButton } from "@/shared/ui/ThemeToggleButton";
import { BrandMark } from "@/shared/ui/BrandMark";
import { useAuthStore } from "@/shared/stores/authStore";
import { PosCart } from "@/widgets/pos-cart/PosCart";
import { PosMenu } from "@/widgets/pos-menu/PosMenu";

export default function SellerPosPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex h-screen flex-col overflow-hidden [padding-left:env(safe-area-inset-left)] [padding-right:env(safe-area-inset-right)]">
      <header className="flex flex-wrap shrink-0 items-center justify-between gap-y-2 border-b border-ink-line bg-ink px-4 py-3 sm:px-6 [padding-top:max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <BrandMark size={28} />
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">POS</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-white/50 sm:inline">{user?.name}</span>
          <Link
            to="/pos/history"
            aria-label={t("history.title")}
            title={t("history.title")}
            className="rounded-xl border border-ink-line p-2 text-white/50 transition hover:border-champ/50 hover:text-white"
          >
            <Receipt className="h-4 w-4" />
          </Link>
          <ChangePasswordButton />
          <ThemeToggleButton />
          <LanguageSwitcher />
          <LogoutButton />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[1fr_380px]">
        <div className="min-h-0 min-w-0 flex-1 lg:border-r lg:border-ink-line [padding-bottom:calc(4rem+env(safe-area-inset-bottom))] lg:[padding-bottom:0px]">
          <PosMenu />
        </div>
        <PosCart />
      </div>
    </div>
  );
}
