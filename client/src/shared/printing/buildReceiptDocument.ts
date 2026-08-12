import { format } from "date-fns";

import { formatPrice, formatSaleQuantity } from "@/entities/product/lib";
import type { Sale } from "@/entities/sale/model";
import type { ReceiptSettings } from "@/entities/setting/model";
import i18n from "@/shared/i18n";
import { dateFnsLocale } from "@/shared/lib/dateLocale";
import type { ReceiptDocument, ReceiptLine } from "./model";

/**
 * The one place that knows how a Sale + company settings turn into a receipt's actual content —
 * pure and printer-agnostic (see model.ts). Reused identically for a just-completed checkout, a
 * "reprint last receipt", and printing from order history, since all three already end up with
 * the same `Sale` shape from the API.
 */
export function buildReceiptDocument(sale: Sale, settings: ReceiptSettings, paperWidthMm: 58 | 80 = 58): ReceiptDocument {
  const lines: ReceiptLine[] = [];

  if (settings.cafe_name) {
    lines.push({ type: "text", value: settings.cafe_name, align: "center", bold: true, size: "large" });
  }
  if (settings.address) lines.push({ type: "text", value: settings.address, align: "center" });
  if (settings.contact_phone) lines.push({ type: "text", value: settings.contact_phone, align: "center" });
  lines.push({ type: "spacer" });

  lines.push({ type: "text", value: sale.receiptNumber, align: "center", bold: true });
  lines.push({
    type: "text",
    value: format(new Date(sale.createdAt), "d MMMM yyyy, HH:mm", { locale: dateFnsLocale() }),
    align: "center",
  });
  lines.push({ type: "rule" });

  if (settings.receipt_header) {
    lines.push({ type: "text", value: settings.receipt_header, align: "center" });
    lines.push({ type: "rule" });
  }

  for (const item of sale.items) {
    // A WEIGHT item's variantLabel is just the pricing tier ("1 кг"), not anything describing
    // *this* sale — the actual weight sold is already the quantity row right below, so pairing
    // it into the title here would just repeat "(1 кг)" on every weighed item regardless of how
    // much was actually sold.
    const label =
      item.saleType !== "WEIGHT" && item.variantLabel && item.variantLabel !== item.productName
        ? `${item.productName} (${item.variantLabel})`
        : item.productName;
    lines.push({ type: "text", value: label });
    lines.push({
      type: "row",
      left: `  ${formatSaleQuantity(item.quantity, item.saleType)} × ${formatPrice(item.unitPrice)}`,
      right: formatPrice(item.subtotal),
    });
  }
  lines.push({ type: "rule" });

  lines.push({ type: "row", left: i18n.t("sale.total"), right: formatPrice(sale.totalAmount), bold: true });
  if (sale.cashReceived) lines.push({ type: "row", left: i18n.t("pos.payment.received"), right: formatPrice(sale.cashReceived) });
  if (sale.changeGiven) lines.push({ type: "row", left: i18n.t("pos.payment.change"), right: formatPrice(sale.changeGiven) });

  if (settings.receipt_footer) {
    lines.push({ type: "spacer" });
    lines.push({ type: "text", value: settings.receipt_footer, align: "center" });
  }

  lines.push({ type: "spacer" });
  lines.push({ type: "cut" });

  return { paperWidthMm, lines };
}
