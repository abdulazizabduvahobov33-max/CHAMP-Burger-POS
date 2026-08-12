import type { ReceiptAlign, ReceiptDocument } from "./model";
import { DEFAULT_TEXT_ENCODING_PROFILE_ID, getTextEncodingProfile } from "./textEncoding/registry";

/**
 * Turns a printer-agnostic ReceiptDocument into raw ESC/POS bytes for the XPrinter XP-58IIT (and
 * any other generic ESC/POS 58/80mm thermal printer — this isn't XPrinter-specific). How text
 * itself becomes bytes — codepage, transliteration — is a pluggable TextEncodingProfile (see
 * textEncoding/registry.ts), not hardcoded here; this file only lays out the document.
 */

const ESC = 0x1b;
const GS = 0x1d;

// Standard character budget for Font A on 58mm/80mm thermal paper — true for the overwhelming
// majority of ESC/POS printers including the XP-58IIT; only matters for how `row` lines
// right-align, not for whether printing works at all.
const CHARS_PER_LINE: Record<ReceiptDocument["paperWidthMm"], number> = { 58: 32, 80: 48 };

function padRow(left: string, right: string, width: number): string[] {
  if (left.length + right.length + 1 <= width) {
    return [left + " ".repeat(width - left.length - right.length) + right];
  }
  // Doesn't fit on one line — label on its own line, price right-aligned on the next, same as a
  // long product name would wrap on a real receipt instead of getting silently truncated.
  const rightLine = right.length >= width ? right : " ".repeat(width - right.length) + right;
  return [left, rightLine];
}

function centerText(text: string, width: number): string {
  if (text.length >= width) return text;
  const padTotal = width - text.length;
  const padLeft = Math.floor(padTotal / 2);
  return " ".repeat(padLeft) + text;
}

function rightAlign(text: string, width: number): string {
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

export function buildEscPosBytes(doc: ReceiptDocument, textEncodingProfileId: string = DEFAULT_TEXT_ENCODING_PROFILE_ID): Uint8Array {
  const profile = getTextEncodingProfile(textEncodingProfileId);
  const width = CHARS_PER_LINE[doc.paperWidthMm];
  const bytes: number[] = [];

  const push = (...b: number[]) => bytes.push(...b);
  const pushText = (text: string) => {
    const transliterated = profile.transliterate ? profile.transliterate(text) : text;
    bytes.push(...profile.encode(transliterated));
  };
  const newline = () => bytes.push(0x0a);

  push(ESC, 0x40); // ESC @ — initialize, clears any stuck state from a previous job
  push(ESC, 0x74, profile.codepageTable); // ESC t n — select character code table

  function renderPlainLine(text: string, opts: { align?: ReceiptAlign; bold?: boolean; large?: boolean } = {}) {
    const alignMap: Record<ReceiptAlign, number> = { left: 0, center: 1, right: 2 };
    push(ESC, 0x61, alignMap[opts.align ?? "left"]);
    if (opts.bold) push(ESC, 0x45, 1);
    if (opts.large) push(GS, 0x21, 0x11);
    pushText(text);
    if (opts.large) push(GS, 0x21, 0x00);
    if (opts.bold) push(ESC, 0x45, 0);
    newline();
  }

  for (const line of doc.lines) {
    switch (line.type) {
      case "text": {
        // No manual centering/padding needed — ESC a (alignment) is a printer-side command,
        // not something this encoder computes by inserting spaces.
        renderPlainLine(line.value, { align: line.align, bold: line.bold, large: line.size === "large" });
        break;
      }
      case "row": {
        for (const rowLine of padRow(line.left, line.right, width)) {
          renderPlainLine(rowLine, { bold: line.bold });
        }
        break;
      }
      case "rule": {
        renderPlainLine("-".repeat(width));
        break;
      }
      case "spacer": {
        newline();
        break;
      }
      case "cut": {
        push(0x0a, 0x0a, 0x0a); // feed a few lines so the cut lands past the printed text
        push(GS, 0x56, 0x00); // GS V 0 — full cut, the most widely-supported cut command
        break;
      }
    }
  }

  return new Uint8Array(bytes);
}

// Exported for tests/tools that want to sanity-check alignment without a real printer.
export const __internal = { centerText, rightAlign, padRow };
