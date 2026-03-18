'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { translations, type Lang, type Translations } from '@/constants/translations';

interface LangContextValue {
  lang: Lang;
  t: Translations;
  setLang: (lang: Lang) => void;
  isRTL: boolean;
}

const LangContext = createContext<LangContextValue | null>(null);

function detectBrowserLang(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  const primary = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
  return primary.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    const stored = localStorage.getItem('lang') as Lang | null;
    return stored ?? detectBrowserLang();
  });

  useEffect(() => {
    applyLangToDOM(lang);
  }, [lang]);

  const setLang = (next: Lang) => {
    setLangState(next);
    applyLangToDOM(next);
    try {
      localStorage.setItem('lang', next);
    } catch {}
  };

  return (
    <LangContext.Provider
      value={{
        lang,
        t: translations[lang] as unknown as Translations,
        setLang,
        isRTL: lang === 'ar',
      }}
    >
      {children}
    </LangContext.Provider>
  );
}

function applyLangToDOM(lang: Lang) {
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>');
  return ctx;
}
