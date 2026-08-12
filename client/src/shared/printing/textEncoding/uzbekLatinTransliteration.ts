/**
 * Cyrillic → Latin transliteration for the Uzbek alphabet, following the same
 * digraph/apostrophe scheme O'zbek lotin alifbosi uses (Ш → Sh, Ў → O', etc.) — not a general
 * Russian transliteration. Exists specifically because CP1251 (Windows Cyrillic, see
 * ../textEncoding/cp1251.ts) has no code point at all for Ў/Ғ/Қ/Ҳ: those four are Uzbek-specific
 * Cyrillic letters outside the Russian alphabet CP1251 actually covers, so a receipt printer
 * selecting table CP1251 renders them as '?' or garbage — not a wrong-glyph problem, a
 * no-glyph-exists-in-this-codepage problem. Transliterating the whole string to Latin sidesteps
 * codepages entirely (plain ASCII prints correctly on literally any ESC/POS firmware), rather
 * than trying to find some codepage that happens to cover all of Cyrillic *and* Ў/Ғ/Қ/Ҳ (most
 * printers' built-in tables don't, since they're built for Russian/Eastern European markets).
 *
 * Text already written in Latin passes through completely unchanged — nothing here maps a
 * character that isn't in the Cyrillic ranges below.
 */

// Uppercase and lowercase kept as separate maps (not one map + a .toLowerCase() step) so a
// digraph's output case is simple to get right: "Ч" -> "Ch" (capital only on the first letter,
// matching how a Title Case Cyrillic word should transliterate), "ч" -> "ch".
const UPPER_MAP: Record<string, string> = {
  А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ж: "J", З: "Z", И: "I",
  Й: "Y", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R", С: "S",
  Т: "T", У: "U", Ф: "F", Х: "X", Ц: "Ts", Ч: "Ch", Ш: "Sh", Ъ: "'", Ы: "I",
  Ь: "", Э: "E", Ю: "Yu", Я: "Ya", Ё: "Yo",
  // Uzbek-specific letters — the actual root cause this module exists to fix.
  Ў: "O'", Ғ: "G'", Қ: "Q", Ҳ: "H",
};

const LOWER_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "j", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s",
  т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", ъ: "'", ы: "i",
  ь: "", э: "e", ю: "yu", я: "ya", ё: "yo",
  ў: "o'", ғ: "g'", қ: "q", ҳ: "h",
};

export function transliterateUzbekCyrillicToLatin(text: string): string {
  let result = "";
  for (const ch of text) {
    result += UPPER_MAP[ch] ?? LOWER_MAP[ch] ?? ch;
  }
  return result;
}
