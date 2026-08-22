"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PokeType } from "@/lib/types";
import type { RarityTier } from "@/lib/rarity";
import { DEFAULT_LOCALE, isLocale, TYPE_LABEL, translate, type Locale, RARITY_LABEL } from "@/lib/i18n";

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LocaleCtx = createContext<Ctx>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k) => translate(DEFAULT_LOCALE, k),
});

const STORAGE_KEY = "piwdex.lang";

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Comeca no default (pt) pra bater com o SSR; ajusta pra preferencia salva no mount.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (isLocale(saved) && saved !== locale) setLocaleState(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "pt" ? "pt-BR" : locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export const useLocale = () => useContext(LocaleCtx);
export const useT = () => useContext(LocaleCtx).t;
export const useRarityLabel = () => {
  const { locale } = useContext(LocaleCtx);
  return (tier: RarityTier) => RARITY_LABEL[locale][tier] ?? String(tier);
};

export const useTypeLabel = () => {
  const { locale } = useContext(LocaleCtx);
  return (type: PokeType | string) => TYPE_LABEL[locale][type as PokeType] ?? String(type);
};

/** Texto traduzido pra usar dentro de server components. */
export function T({ k, vars }: { k: string; vars?: Record<string, string | number> }) {
  const t = useT();
  return <>{t(k, vars)}</>;
}

/** Texto com um trecho em negrito (marcado por {b} na string, traduzido por bKey). */
export function TB({ k, bKey, className }: { k: string; bKey: string; className?: string }) {
  const t = useT();
  const [before, after] = t(k).split("{b}");
  return (
    <>
      {before}
      <strong className={className ?? "text-text"}>{t(bKey)}</strong>
      {after}
    </>
  );
}
