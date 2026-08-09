import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePendingSales } from "@/entities/sale/api";
import { ChangePasswordButton } from "@/features/change-password/ChangePasswordButton";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { HeaderOverflowMenu } from "@/shared/ui/HeaderOverflowMenu";
import { LanguageSwitcher } from "@/shared/ui/LanguageSwitcher";
import { ThemeToggleButton } from "@/shared/ui/ThemeToggleButton";
import { BrandMark } from "@/shared/ui/BrandMark";
import { useAuthStore } from "@/shared/stores/authStore";
import { PendingOrdersPanel } from "@/widgets/pending-orders/PendingOrdersPanel";
import { PosCart } from "@/widgets/pos-cart/PosCart";
import { PosMenu } from "@/widgets/pos-menu/PosMenu";

// The register screen: an admin at the till builds an order and hits "Принять заказ" (mode
// "accept" — auto-accepted, stock deducted and receipt printed immediately, no dialog) instead of
// a waiter's "Отправить заказ". The same screen surfaces waiters' pending orders for a one-tap
// accept, since this is the one place the admin will be looking at while running the register.
export default function AdminPosPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: pending } = usePendingSales();
  const [pendingOpen, setPendingOpen] = useState(false);
  const pendingCount = pending?.length ?? 0;

  return (
    <div className="flex h-screen flex-col overflow-hidden [padding-left:env(safe-area-inset-left)] [padding-right:env(safe-area-inset-right)]">
      <header className="flex flex-wrap shrink-0 items-center justify-between gap-y-2 border-b border-ink-line bg-ink px-4 py-3 sm:px-6 [padding-top:max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <Link
            to="/admin"
            className="rounded-lg p-2 text-white/40 transition hover:bg-ink-soft hover:text-white"
            aria-label={t("common.backToAdminAria")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <BrandMark size={28} />
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">{t("pos.registerTitle")}</h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPendingOpen(true)}
            className="relative flex items-center gap-2 rounded-xl border border-ink-line px-3 py-2 text-sm font-medium text-white/60 transition hover:border-champ/50 hover:text-white"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">{t("pos.pending.title")}</span>
            {pendingCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-champ px-1 text-[11px] font-bold text-onaccent">
                {pendingCount}
              </span>
            )}
          </button>
          <span className="hidden text-sm text-white/50 sm:inline">{user?.name}</span>
          <HeaderOverflowMenu>
            <ChangePasswordButton />
            <ThemeToggleButton />
            <LanguageSwitcher />
          </HeaderOverflowMenu>
          <LogoutButton />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[1fr_380px]">
        <div className="min-h-0 min-w-0 flex-1 lg:border-r lg:border-ink-line [padding-bottom:calc(4rem+env(safe-area-inset-bottom))] lg:[padding-bottom:0px]">
          <PosMenu />
        </div>
        <PosCart mode="accept" />
      </div>

      <PendingOrdersPanel open={pendingOpen} onClose={() => setPendingOpen(false)} />
    </div>
  );
}
