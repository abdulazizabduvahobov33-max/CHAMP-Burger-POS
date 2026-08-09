import type { ReceiptAlign, ReceiptDocument } from "./model";

/**
 * Turns a printer-agnostic ReceiptDocument into raw ESC/POS bytes for the XPrinter XP-58IIT (and
 * any other generic ESC/POS 58/80mm thermal printer — this isn't XPrinter-specific beyond the
 * codepage choice below). This is the one place that needs adjusting if a specific unit's
 * firmware disagrees with these defaults — see CODEPAGE_TABLE and CHARS_PER_LINE below.
 */

const ESC = 0x1b;
const GS = 0x1d;

// XPrinter's documented Cyrillic codepage slot for the XP-58 series is commonly table 6
// (Windows-1251) — if receipts print Cyrillic as garbage/boxes on your specific unit, this is
// the first thing to try changing (common alternates: 17 for CP866, 19 for CP1251 on some
// firmware revisions — check the printer's own manual / test page).
const CODEPAGE_TABLE = 6;

// Standard character budget for Font A on 58mm/80mm thermal paper — true for the overwhelming
// majority of ESC/POS printers including the XP-58IIT; only matters for how `row` lines
// right-align, not for whether printing works at all.
const CHARS_PER_LINE: Record<ReceiptDocument["paperWidthMm"], number> = { 58: 32, 80: 48 };

/**
 * Encodes a Unicode string to CP1251 (Windows Cyrillic) bytes. ASCII passes through unchanged;
 * the full А-Я/а-я block maps via one linear offset (both Unicode's Cyrillic block and CP1251's
 * upper range are internally contiguous — no per-letter table needed); Ё/ё and the handful of
 * punctuation marks CP1251 relocates (guillemets, dashes, curly quotes, ellipsis) are special-
 * cased. Anything else falls back to '?' rather than throwing — a receipt with one wrong glyph
 * still prints; a crashed print job doesn't.
 */
function encodeCp1251(text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code <= 0x7f) {
      bytes.push(code);
    } else if (code >= 0x0410 && code <= 0x044f) {
      bytes.push(code - 0x0410 + 0xc0);
    } else if (code === 0x0401) {
      bytes.push(0xa8); // Ё
    } else if (code === 0x0451) {
      bytes.push(0xb8); // ё
    } else {
      const extra: Record<number, number> = {
        0x00ab: 0xab, // «
        0x00bb: 0xbb, // »
        0x2014: 0x97, // — em dash
        0x2013: 0x96, // – en dash
        0x2018: 0x91, // ' left single quote
        0x2019: 0x92, // ' right single quote
        0x201c: 0x93, // " left double quote
        0x201d: 0x94, // " right double quote
        0x2026: 0x85, // … ellipsis
        0x00a0: 0xa0, // non-breaking space
        0x00d7: 0x78, // × multiplication sign -> "x" (not in CP1251 at all)
      };
      bytes.push(extra[code] ?? 0x3f); // '?' fallback
    }
  }
  return bytes;
}

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

export function buildEscPosBytes(doc: ReceiptDocument): Uint8Array {
  const width = CHARS_PER_LINE[doc.paperWidthMm];
  const bytes: number[] = [];

  const push = (...b: number[]) => bytes.push(...b);
  const pushText = (text: string) => bytes.push(...encodeCp1251(text));
  const newline = () => bytes.push(0x0a);

  push(ESC, 0x40); // ESC @ — initialize, clears any stuck state from a previous job
  push(ESC, 0x74, CODEPAGE_TABLE); // ESC t n — select character code table

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
export const __internal = { centerText, rightAlign, padRow, encodeCp1251 };
