import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { en } from "@/lib/i18n/en";
import { uz } from "@/lib/i18n/uz";

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "uz", label: "O'zbekcha" },
] as const;

export type Language = (typeof LANGUAGES)[number]["value"];

const DICTIONARIES: Record<Language, typeof en> = { en, uz };

// Recursively derive "a.b.c"-style dot paths for every string leaf in the
// dictionary shape, so t() rejects typos at compile time.
type Path<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Path<T[K]>}` }[keyof T & string];

export type TranslationKey = Path<typeof en>;

const STORAGE_KEY = "library_language";

function isLanguage(value: string | null): value is Language {
  return LANGUAGES.some((l) => l.value === value);
}

function lookup(dict: typeof en, key: string): string {
  const value = key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
  return typeof value === "string" ? value : key;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match
  );
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isLanguage(stored) ? stored : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  function setLanguage(next: Language) {
    setLanguageState(next);
  }

  function t(key: TranslationKey, params?: Record<string, string | number>): string {
    return interpolate(lookup(DICTIONARIES[language], key), params);
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
  );
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used within LanguageProvider");
  return ctx;
}
