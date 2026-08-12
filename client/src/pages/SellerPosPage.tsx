import { Link } from "react-router-dom";
import { Receipt } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTables } from "@/entities/table/api";
import { ChangePasswordButton } from "@/features/change-password/ChangePasswordButton";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { HeaderOverflowMenu } from "@/shared/ui/HeaderOverflowMenu";
import { LanguageSwitcher } from "@/shared/ui/LanguageSwitcher";
import { ThemeToggleButton } from "@/shared/ui/ThemeToggleButton";
import { BrandMark } from "@/shared/ui/BrandMark";
import { useAuthStore } from "@/shared/stores/authStore";
import { useCartStore } from "@/shared/stores/cartStore";
import { PosCart } from "@/widgets/pos-cart/PosCart";
import { PosMenu } from "@/widgets/pos-menu/PosMenu";
import { TablePicker } from "@/widgets/table-picker/TablePicker";

export default function SellerPosPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const tableId = useCartStore((s) => s.tableId);
  const setTable = useCartStore((s) => s.setTable);
  const cartIsEmpty = useCartStore((s) => s.lines.length === 0);
  const { data: tables } = useTables();
  const selectedTable = tables?.find((table) => table.id === tableId) ?? null;

  // Every new order must start with a table pick — the whole point of the table system is
  // knowing where an order came from, so this isn't skippable. Once the cart has items, the
  // gate stays out of the way even if a table becomes inactive mid-order (edge case, not worth
  // yanking the waiter back to the picker mid-build); a fresh order (empty cart, no table) always
  // shows it again.
  const showTablePickerGate = cartIsEmpty && tableId === null;

  return (
    <div className="flex h-screen flex-col overflow-hidden [padding-left:env(safe-area-inset-left)] [padding-right:env(safe-area-inset-right)]">
      <header className="flex flex-wrap shrink-0 items-center justify-between gap-y-2 border-b border-ink-line bg-ink px-4 py-3 sm:px-6 [padding-top:max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <BrandMark size={28} />
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">POS</h1>
          {!showTablePickerGate && selectedTable && (
            <button
              type="button"
              onClick={() => setTable(null)}
              className="flex items-center gap-1.5 rounded-full bg-champ/15 px-3 py-1 text-sm font-bold text-champ transition hover:bg-champ/25"
            >
              {t("table.numberShort", { number: selectedTable.number })}
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-white/50 sm:inline">{user?.name}</span>
          <Link
            to="/pos/history"
            aria-label={t("history.title")}
            title={t("history.title")}
            className="rounded-xl border border-ink-line p-2 text-white/50 transition hover:border-champ/50 hover:text-white"
          >
            <Receipt className="h-4 w-4" />
          </Link>
          <HeaderOverflowMenu>
            <ChangePasswordButton />
            <ThemeToggleButton />
            <LanguageSwitcher />
          </HeaderOverflowMenu>
          <LogoutButton />
        </div>
      </header>

      {showTablePickerGate ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-6 [padding-bottom:max(1.5rem,env(safe-area-inset-bottom))]">
          <h2 className="mb-4 text-center text-lg font-bold text-white">{t("table.pickerTitle")}</h2>
          <TablePicker selectedTableId={tableId} onSelect={setTable} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[1fr_380px]">
          <div className="min-h-0 min-w-0 flex-1 lg:border-r lg:border-ink-line [padding-bottom:calc(4rem+env(safe-area-inset-bottom))] lg:[padding-bottom:0px]">
            <PosMenu />
          </div>
          <PosCart />
        </div>
      )}
    </div>
  );
}
