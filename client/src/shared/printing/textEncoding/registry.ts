import { encodeCp1251 } from "./cp1251";
import type { TextEncodingProfile } from "./model";
import { transliterateUzbekCyrillicToLatin } from "./uzbekLatinTransliteration";

/**
 * Every text-encoding strategy the app knows about, keyed by id. Today there's one — CP1251 with
 * Uzbek-Latin transliteration, which is what every printer this app has actually been set up
 * against (XPrinter XP-58IIT and compatible generic ESC/POS units) understands. A future printer
 * that needs a different codepage (CP866, CP1252, ...) or no transliteration at all is a new
 * object here plus a new file next to cp1251.ts if it needs its own byte encoder — nothing in
 * escpos.ts or either printer driver changes.
 */
export const TEXT_ENCODING_PROFILES: Record<string, TextEncodingProfile> = {
  "cp1251-uz-latin": {
    id: "cp1251-uz-latin",
    label: "CP1251 (кириллица) + узбекская латинская транслитерация",
    codepageTable: 6,
    transliterate: transliterateUzbekCyrillicToLatin,
    encode: encodeCp1251,
  },
};

export const DEFAULT_TEXT_ENCODING_PROFILE_ID = "cp1251-uz-latin";

export function getTextEncodingProfile(id: string = DEFAULT_TEXT_ENCODING_PROFILE_ID): TextEncodingProfile {
  return TEXT_ENCODING_PROFILES[id] ?? TEXT_ENCODING_PROFILES[DEFAULT_TEXT_ENCODING_PROFILE_ID];
}
