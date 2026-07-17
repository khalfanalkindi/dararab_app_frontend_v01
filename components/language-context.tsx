"use client"

import * as React from "react"
import {
  languageDir,
  persistLanguage,
  type AppLanguage,
} from "@/lib/language"
import {
  translate,
  type MessageKey,
  type TranslateFn,
  type TranslateParams,
} from "@/lib/i18n"

type LanguageContextValue = {
  language: AppLanguage
  dir: "ltr" | "rtl"
  t: TranslateFn
  setLanguage: (lang: AppLanguage) => void
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null)

export function LanguageProvider({
  children,
  initialLanguage = "en",
}: {
  children: React.ReactNode
  initialLanguage?: AppLanguage
}) {
  const [language, setLanguageState] = React.useState<AppLanguage>(initialLanguage)

  React.useEffect(() => {
    const sync = () => {
      const next =
        document.documentElement.lang === "ar" || document.documentElement.lang === "en"
          ? document.documentElement.lang
          : initialLanguage
      setLanguageState(next)
    }
    sync()

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "lang" || mutation.attributeName === "dir") {
          sync()
        }
      }
    })
    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [initialLanguage])

  const setLanguage = React.useCallback((lang: AppLanguage) => {
    persistLanguage(lang)
    setLanguageState(lang)
  }, [])

  const t = React.useCallback<TranslateFn>(
    (key: MessageKey | string, params?: TranslateParams) => translate(language, key, params),
    [language],
  )

  const value = React.useMemo<LanguageContextValue>(
    () => ({
      language,
      dir: languageDir(language),
      t,
      setLanguage,
    }),
    [language, t, setLanguage],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = React.useContext(LanguageContext)
  if (!ctx) {
    // Safe fallback for rare cases outside the provider (tests / isolated renders).
    return {
      language: "en",
      dir: "ltr",
      t: (key, params) => translate("en", key, params),
      setLanguage: () => {},
    }
  }
  return ctx
}

/** Alias matching the plan’s `useTranslation()` naming. */
export function useTranslation() {
  const { t, language, dir, setLanguage } = useLanguage()
  return { t, language, dir, setLanguage }
}
