import { useEffect, useRef, useState, type ReactNode } from "react";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCreateSale } from "@/entities/sale/api";
import { formatPrice } from "@/entities/product/lib";
import { ProductImage } from "@/entities/product/ui/ProductImage";
import { getErrorMessage } from "@/shared/lib/errors";
import { useCartStore, type CartLine } from "@/shared/stores/cartStore";
import { toast } from "@/shared/stores/toastStore";

function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + Number(l.unitPrice) * l.quantity, 0);
}

export function PosCart() {
  const { t } = useTranslation();
  const lines = useCartStore((s) => s.lines);
  const clear = useCartStore((s) => s.clear);
  const total = cartTotal(lines);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  // Owned here (not inside CartBody) so the desktop panel and the mobile sheet — two separate
  // renders of the same cart, switched by CSS breakpoint, not conditional mounting — share one
  // mutation instead of each getting its own independent "is a checkout in flight" state.
  const createSale = useCreateSale();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [lastReceiptTotal, setLastReceiptTotal] = useState<string | null>(null);
  const receiptTimeoutRef = useRef<number>();

  useEffect(() => {
    return () => window.clearTimeout(receiptTimeoutRef.current);
  }, []);

  function handleCheckout() {
    if (lines.length === 0 || createSale.isPending) return;
    setCheckoutError(null);
    setLastReceiptTotal(null);
    createSale.mutate(
      { items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) },
      {
        onSuccess: (sale) => {
          clear();
          // Show what the server actually charged, not the cart's pre-checkout snapshot —
          // they can differ if a price changed while the cart was open.
          setLastReceiptTotal(sale.totalAmount);
          setMobileExpanded(false);
          window.clearTimeout(receiptTimeoutRef.current);
          receiptTimeoutRef.current = window.setTimeout(() => setLastReceiptTotal(null), 4000);
          toast.success(t("pos.saleCompleted", { total: formatPrice(sale.totalAmount) }));
        },
        onError: (err) => setCheckoutError(getErrorMessage(err, t("pos.saleFailed"))),
      },
    );
  }

  const bodyProps = { checkoutError, lastReceiptTotal, isPending: createSale.isPending, onCheckout: handleCheckout };

  return (
    <>
      {/* Desktop / tablet: always-visible side panel */}
      <div className="hidden h-full min-h-0 flex-col lg:flex">
        <CartBody {...bodyProps} />
      </div>

      {/* Mobile: collapsed summary bar that expands into a full-screen sheet */}
      <div className="lg:hidden">
        {!mobileExpanded && (
          <button
            type="button"
            onClick={() => setMobileExpanded(true)}
            disabled={lines.length === 0}
            className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 bg-champ px-4 py-3.5 text-onaccent shadow-card transition disabled:cursor-not-allowed disabled:bg-ink-soft disabled:text-white/30 [padding-bottom:max(0.875rem,env(safe-area-inset-bottom))] [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]"
          >
            <span className="flex items-center gap-2 font-semibold">
              <ShoppingCart className="h-4 w-4" />
              {lines.length === 0 ? t("pos.cartEmpty") : t("pos.itemsCount", { count: lines.reduce((n, l) => n + l.quantity, 0) })}
            </span>
            {lines.length > 0 && <span className="font-bold">{formatPrice(String(total))} →</span>}
          </button>
        )}

        {mobileExpanded && (
          <div className="fixed inset-0 z-50 flex flex-col bg-ink [padding-bottom:env(safe-area-inset-bottom)] [padding-left:env(safe-area-inset-left)] [padding-right:env(safe-area-inset-right)]">
            <div className="flex shrink-0 items-center justify-between border-b border-ink-line p-4 [padding-top:max(1rem,env(safe-area-inset-top))]">
              <h2 className="text-sm font-bold uppercase tracking-wide text-white/50">{t("pos.cartTitle")}</h2>
              <button
                type="button"
                onClick={() => setMobileExpanded(false)}
                aria-label={t("pos.closeCart")}
                className="rounded-lg p-2 text-white/40 transition hover:bg-ink-soft hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <CartBody {...bodyProps} />
          </div>
        )}
      </div>
    </>
  );
}

type CartBodyProps = {
  checkoutError: string | null;
  lastReceiptTotal: string | null;
  isPending: boolean;
  onCheckout: () => void;
};

function CartBody({ checkoutError, lastReceiptTotal, isPending, onCheckout }: CartBodyProps) {
  const { t } = useTranslation();
  const lines = useCartStore((s) => s.lines);
  const incrementQuantity = useCartStore((s) => s.incrementQuantity);
  const decrementQuantity = useCartStore((s) => s.decrementQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);

  const total = cartTotal(lines);

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {lines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center">
            <ShoppingCart className="mb-3 h-8 w-8 text-white/15" />
            <p className="text-sm text-white/40">{t("pos.selectFromLeft")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lines.map((line) => (
              <CartLineRow
                key={line.variantId}
                line={line}
                onIncrement={() => incrementQuantity(line.variantId)}
                onDecrement={() => decrementQuantity(line.variantId)}
                onRemove={() => removeItem(line.variantId)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t border-ink-line p-4">
        {checkoutError && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
            {checkoutError}
          </div>
        )}

        {lastReceiptTotal && !checkoutError && (
          <div role="status" className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
            {t("pos.saleCompleted", { total: formatPrice(lastReceiptTotal) })}
          </div>
        )}

        <div className="flex items-end justify-between">
          <span className="text-sm font-medium text-white/60">{t("pos.total")}</span>
          <span className="text-2xl font-extrabold tracking-tight text-champ">{formatPrice(String(total))}</span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => clear()}
            disabled={lines.length === 0}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-ink-line px-4 py-3 text-sm font-medium text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            {t("pos.clear")}
          </button>
          <button
            type="button"
            onClick={onCheckout}
            disabled={lines.length === 0 || isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-champ py-3 text-sm font-bold text-onaccent shadow-card transition hover:bg-champ-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingCart className="h-4 w-4" />
            {isPending ? t("pos.checkoutPending") : t("pos.checkout")}
          </button>
        </div>
      </div>
    </>
  );
}

function CartLineRow({
  line,
  onIncrement,
  onDecrement,
  onRemove,
}: {
  line: CartLine;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const subtotal = Number(line.unitPrice) * line.quantity;

  return (
    <div className="flex animate-fade-in items-center gap-3 rounded-xl border border-ink-line bg-ink-soft p-3">
      <ProductImage src={line.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{line.productName}</p>
        <p className="truncate text-xs text-white/40">{line.variantLabel}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <IconStepperButton label={t("pos.decreaseQuantity")} onClick={onDecrement}>
          <Minus className="h-3.5 w-3.5" />
        </IconStepperButton>
        <span className="w-6 text-center text-sm font-bold text-white">{line.quantity}</span>
        <IconStepperButton label={t("pos.increaseQuantity")} onClick={onIncrement}>
          <Plus className="h-3.5 w-3.5" />
        </IconStepperButton>
      </div>

      <div className="w-16 shrink-0 text-right text-sm font-bold text-champ">{formatPrice(String(subtotal))}</div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={t("pos.removeFromCart")}
        className="shrink-0 rounded-lg p-2 text-white/30 transition hover:bg-ink-line hover:text-danger-soft"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function IconStepperButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-line text-white/60 transition hover:border-champ/50 hover:text-white active:scale-90"
    >
      {children}
    </button>
  );
}
