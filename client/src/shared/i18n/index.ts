import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import ru from "./locales/ru.json";
import uz from "./locales/uz.json";

export const SUPPORTED_LANGUAGES = ["ru", "uz"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  ru: "Русский",
  uz: "O'zbek",
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      uz: { translation: uz },
    },
    fallbackLng: "ru",
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false }, // React already escapes — avoid double-escaping.
    detection: {
      // Persisted under the same key the rest of the app uses for localStorage lookups
      // (see shared/stores/*Store.ts) — order matters: an explicit prior choice always wins
      // over the browser's Accept-Language header.
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "champ-language",
      caches: ["localStorage"],
    },
  });

export default i18n;
