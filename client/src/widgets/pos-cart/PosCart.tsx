import { useEffect, useRef, useState, type ReactNode } from "react";
import { Minus, Pencil, Plus, Printer, ShoppingCart, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCreateSale } from "@/entities/sale/api";
import { formatPrice, formatSaleQuantity } from "@/entities/product/lib";
import type { Sale } from "@/entities/sale/model";
import { ProductImage } from "@/entities/product/ui/ProductImage";
import { WeightEntryDialog } from "@/features/pos-weight-entry/WeightEntryDialog";
import { PaymentDialog } from "@/features/pos-payment/PaymentDialog";
import { getErrorMessage } from "@/shared/lib/errors";
import { usePrintReceipt } from "@/shared/printing/usePrintReceipt";
import { useCartStore, type CartLine } from "@/shared/stores/cartStore";
import { useWeightEntryStore } from "@/shared/stores/weightEntryStore";
import { toast } from "@/shared/stores/toastStore";

function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + Number(l.unitPrice) * l.quantity, 0);
}

type PosCartMode = "send" | "accept";

export function PosCart({ mode = "send" }: { mode?: PosCartMode } = {}) {
  const { t } = useTranslation();
  const lines = useCartStore((s) => s.lines);
  const clear = useCartStore((s) => s.clear);
  const tableId = useCartStore((s) => s.tableId);
  const total = cartTotal(lines);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Owned here (not inside CartBody) so the desktop panel and the mobile sheet — two separate
  // renders of the same cart, switched by CSS breakpoint, not conditional mounting — share one
  // mutation instead of each getting its own independent "is a checkout in flight" state.
  const createSale = useCreateSale();
  const { printReceipt } = usePrintReceipt();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [lastReceiptTotal, setLastReceiptTotal] = useState<string | null>(null);
  // Kept separately from lastReceiptTotal (which only drives the 4s success banner) — a cashier
  // may want to reprint a receipt well after that banner has faded, e.g. the first copy jammed
  // or a customer asks again a minute later. Persists for the rest of the session, not on a timer.
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const receiptTimeoutRef = useRef<number>();

  useEffect(() => {
    return () => window.clearTimeout(receiptTimeoutRef.current);
  }, []);

  async function handlePrint(sale: Sale) {
    const result = await printReceipt(sale);
    if (result.ok) {
      toast.success(t("printing.printed"));
    } else {
      toast.error(t("printing.printFailed"));
    }
  }

  function handlePaymentConfirm(cashReceived: number) {
    if (lines.length === 0 || createSale.isPending) return;
    setCheckoutError(null);
    setLastReceiptTotal(null);
    createSale.mutate(
      {
        items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        cashReceived,
        tableId: tableId ?? undefined,
      },
      {
        onSuccess: (sale) => {
          clear();
          setPaymentOpen(false);
          // Show what the server actually charged, not the cart's pre-checkout snapshot —
          // they can differ if a price changed while the cart was open.
          setLastReceiptTotal(sale.totalAmount);
          setLastSale(sale);
          setMobileExpanded(false);
          window.clearTimeout(receiptTimeoutRef.current);
          receiptTimeoutRef.current = window.setTimeout(() => setLastReceiptTotal(null), 4000);
          if (sale.status === "PENDING") {
            toast.success(t("pos.orderSentPending"));
          } else {
            toast.success(t("pos.saleCompleted", { total: formatPrice(sale.totalAmount) }));
            // Register mode: the cashier has no time to hunt for a print button between
            // customers — fire the receipt straight to the paired printer (or the preview
            // fallback) the moment the sale is confirmed.
            if (mode === "accept") void handlePrint(sale);
          }
        },
        onError: (err) => setCheckoutError(getErrorMessage(err, t("pos.saleFailed"))),
      },
    );
  }

  const bodyProps = {
    mode,
    checkoutError,
    lastReceiptTotal,
    lastSale,
    isPending: createSale.isPending,
    onCheckout: () => {
      setCheckoutError(null);
      setPaymentOpen(true);
    },
    onPrint: handlePrint,
  };

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
              {lines.length === 0
                ? t("pos.cartEmpty")
                : // A weighed line counts as one position here, not its fractional kilogram
                  // amount — "2.8" would misread as a typo where "3" (2 counted items + 1
                  // weighed one) reads as an actual item count.
                  t("pos.itemsCount", { count: lines.reduce((n, l) => n + (l.saleType === "WEIGHT" ? 1 : l.quantity), 0) })}
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

      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        total={total}
        isPending={createSale.isPending}
        error={checkoutError}
        onConfirm={handlePaymentConfirm}
      />

      {/* Global, not scoped to this cart instance — PosMenu opens the same dialog (see
          shared/stores/weightEntryStore.ts) when a WEIGHT product is tapped. Mounted here
          because PosCart is the one thing guaranteed to render once per POS page. */}
      <WeightEntryDialog />
    </>
  );
}

type CartBodyProps = {
  mode: PosCartMode;
  checkoutError: string | null;
  lastReceiptTotal: string | null;
  lastSale: Sale | null;
  isPending: boolean;
  onCheckout: () => void;
  onPrint: (sale: Sale) => void;
};

function CartBody({ mode, checkoutError, lastReceiptTotal, lastSale, isPending, onCheckout, onPrint }: CartBodyProps) {
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
            {lastSale && lastSale.status === "ACCEPTED" && (
              <button
                type="button"
                onClick={() => onPrint(lastSale)}
                className="mt-4 flex items-center gap-2 rounded-xl border border-ink-line px-4 py-2.5 text-sm font-medium text-white/60 transition hover:border-champ/50 hover:text-white"
              >
                <Printer className="h-4 w-4" />
                {t("printing.reprintLast")}
              </button>
            )}
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
          <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
            <span>
              {lastSale?.status === "PENDING"
                ? t("pos.orderSentPending")
                : t("pos.saleCompleted", { total: formatPrice(lastReceiptTotal) })}
            </span>
            {lastSale && lastSale.status === "ACCEPTED" && (
              <button
                type="button"
                onClick={() => onPrint(lastSale)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-success/15 px-2.5 py-1.5 text-xs font-bold text-success transition hover:bg-success/25"
              >
                <Printer className="h-3.5 w-3.5" />
                {t("printing.print")}
              </button>
            )}
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
            {mode === "accept"
              ? isPending
                ? t("pos.acceptingOrder")
                : t("pos.acceptOrder")
              : isPending
                ? t("pos.sendingOrder")
                : t("pos.sendOrder")}
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
  const isWeight = line.saleType === "WEIGHT";
  const subtotal = Number(line.unitPrice) * line.quantity;
  const openWeightEntry = useWeightEntryStore((s) => s.open);

  function handleEditWeight() {
    openWeightEntry({
      variantId: line.variantId,
      productId: line.productId,
      productName: line.productName,
      variantLabel: line.variantLabel,
      imageUrl: line.imageUrl,
      unitPrice: line.unitPrice,
      initialGrams: Math.round(line.quantity * 1000),
    });
  }

  return (
    <div className="flex animate-fade-in items-center gap-3 rounded-xl border border-ink-line bg-ink-soft p-3">
      <ProductImage src={line.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{line.productName}</p>
        <p className="truncate text-xs text-white/40">
          {isWeight ? `${formatSaleQuantity(line.quantity, "WEIGHT")} × ${formatPrice(line.unitPrice)}` : line.variantLabel}
        </p>
      </div>

      {isWeight ? (
        <button
          type="button"
          onClick={handleEditWeight}
          aria-label={t("pos.weight.edit")}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-ink-line px-2.5 text-xs font-medium text-white/60 transition hover:border-champ/50 hover:text-white"
        >
          <Pencil className="h-3.5 w-3.5" />
          {t("pos.weight.edit")}
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5">
          <IconStepperButton label={t("pos.decreaseQuantity")} onClick={onDecrement}>
            <Minus className="h-3.5 w-3.5" />
          </IconStepperButton>
          <span className="w-6 text-center text-sm font-bold text-white">{line.quantity}</span>
          <IconStepperButton label={t("pos.increaseQuantity")} onClick={onIncrement}>
            <Plus className="h-3.5 w-3.5" />
          </IconStepperButton>
        </div>
      )}

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
