import { useTranslation } from "react-i18next";

import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/shared/i18n";

/** Self-contained, like ThemeToggleButton/ChangePasswordButton/LogoutButton — drop next to them in any header. */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
    ? (i18n.language as SupportedLanguage)
    : "ru";

  return (
    <select
      value={current}
      onChange={(e) => void i18n.changeLanguage(e.target.value)}
      aria-label={LANGUAGE_LABELS[current]}
      className="rounded-xl border border-ink-line bg-transparent px-2.5 py-2 text-sm font-medium text-white/70 transition hover:border-champ/50 hover:text-white"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang} value={lang} className="bg-ink-card text-white">
          {LANGUAGE_LABELS[lang]}
        </option>
      ))}
    </select>
  );
}
