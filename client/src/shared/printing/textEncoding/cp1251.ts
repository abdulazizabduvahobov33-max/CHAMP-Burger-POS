/**
 * Encodes a Unicode string to CP1251 (Windows Cyrillic) bytes. ASCII passes through unchanged;
 * the full А-Я/а-я block maps via one linear offset (both Unicode's Cyrillic block and CP1251's
 * upper range are internally contiguous — no per-letter table needed); Ё/ё and the handful of
 * punctuation marks CP1251 relocates (guillemets, dashes, curly quotes, ellipsis) are special-
 * cased. Anything else falls back to '?' rather than throwing — a receipt with one wrong glyph
 * still prints; a crashed print job doesn't.
 *
 * By the time this runs, uzbekLatinTransliteration.ts has already turned any Uzbek-specific
 * letters (Ў/Ғ/Қ/Ҳ — genuinely outside CP1251, not just unmapped here) into plain ASCII, so this
 * function only ever needs to handle standard Cyrillic as a fallback for text that wasn't
 * transliterated (see textEncoding/registry.ts) — it doesn't know or care that step happened.
 */
export function encodeCp1251(text: string): number[] {
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
