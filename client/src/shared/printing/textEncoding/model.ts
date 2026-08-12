/**
 * How Unicode text becomes bytes a specific printer/codepage can actually render — pulled out as
 * its own pluggable thing (not hardcoded into escpos.ts) so a different printer model or a
 * different codepage is a new profile object, not a rewrite of the ESC/POS byte builder. See
 * registry.ts for what's registered today and buildEscPosBytes() in ../escpos.ts for the one
 * place this plugs in.
 */
export type TextEncodingProfile = {
  id: string;
  label: string;
  /** ESC t n — the codepage table number the printer should switch to before printing text this
   * profile encodes. */
  codepageTable: number;
  /** Runs once per string, before `encode` — e.g. Cyrillic → Latin transliteration for a
   * codepage that can't represent some source characters at all (see
   * uzbekLatinTransliteration.ts). Optional: a profile whose codepage already covers everything
   * it'll ever be asked to print (a plain ASCII-only one, say) can skip this entirely. */
  transliterate?: (text: string) => string;
  /** Turns the (possibly already-transliterated) string into raw bytes for `codepageTable`. */
  encode: (text: string) => number[];
};
