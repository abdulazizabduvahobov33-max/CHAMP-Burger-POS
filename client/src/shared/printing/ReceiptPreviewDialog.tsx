import { useTranslation } from "react-i18next";

import { Dialog } from "@/shared/ui/Dialog";
import { usePrinterStore } from "./printerStore";
import type { ReceiptLine } from "./model";

/**
 * Renders whatever the active driver would have sent to a physical printer — mounted once near
 * the app root (App.tsx) and driven entirely by printerStore, so any driver's print() can pop it
 * open without needing a dialog of its own. Styled to actually look like a strip of thermal
 * paper (white, monospace, dashed rules) rather than the app's own dark cards, since the whole
 * point is previewing what a customer would physically hold.
 */
export function ReceiptPreviewDialog() {
  const { t } = useTranslation();
  const doc = usePrinterStore((s) => s.previewDocument);
  const closePreview = usePrinterStore((s) => s.closePreview);

  return (
    <Dialog open={doc !== null} onClose={closePreview} title={t("printing.previewTitle")} widthClassName="max-w-xs">
      {doc && (
        <div>
          <div className="mx-auto max-w-[280px] rounded-sm bg-white px-4 py-5 font-mono text-[13px] leading-relaxed text-black shadow-inner">
            {doc.lines.map((line, i) => (
              <ReceiptLineView key={i} line={line} />
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-white/40">{t("printing.previewNote")}</p>
        </div>
      )}
    </Dialog>
  );
}

function ReceiptLineView({ line }: { line: ReceiptLine }) {
  switch (line.type) {
    case "text":
      return (
        <p
          className={`${line.align === "center" ? "text-center" : line.align === "right" ? "text-right" : "text-left"} ${
            line.bold ? "font-bold" : ""
          } ${line.size === "large" ? "text-base" : ""}`}
        >
          {line.value}
        </p>
      );
    case "row":
      return (
        <p className={`flex justify-between gap-2 ${line.bold ? "font-bold" : ""}`}>
          <span className="truncate">{line.left}</span>
          <span className="shrink-0">{line.right}</span>
        </p>
      );
    case "rule":
      return <p className="my-1 border-t border-dashed border-black/40" aria-hidden />;
    case "spacer":
      return <div className="h-2.5" aria-hidden />;
    case "cut":
      return null;
    default:
      return null;
  }
}
