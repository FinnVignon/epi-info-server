import { createContext, useContext, useState, type ReactNode } from "react";

import en from "./en.json";
import fr from "./fr.json";

export type Language = "en" | "fr";
export type Translations = typeof en;

const translations: Record<Language, Translations> = { en, fr };

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    const stored = localStorage.getItem("epi-admin-lang");
    return stored === "fr" || stored === "en" ? stored : "en";
  });

  function handleSetLang(nextLang: Language) {
    localStorage.setItem("epi-admin-lang", nextLang);
    setLang(nextLang);
  }

  return (
    <I18nContext.Provider value={{ lang, setLang: handleSetLang, t: translations[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used inside I18nProvider");
  return ctx;
}

export function formatTranslation(
  template: string,
  values: Record<string, number | string>,
): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );
}
