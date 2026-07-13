"use client"

import * as React from "react"
import { LANGUAGE_COOKIE, languageDir, normalizeLanguage, type AppLanguage } from "@/lib/language"

type LanguageContextValue = {
  language: AppLanguage
  t: (key: string) => string
  dir: "ltr" | "rtl"
}

const LanguageContext = React.createContext<LanguageContextValue>({
  language: "en",
  t: (key: string) => key,
  dir: "ltr",
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = React.useState<AppLanguage>("en")

  React.useEffect(() => {
    const sync = () => {
      const next = normalizeLanguage(
        document.documentElement.lang || localStorage.getItem(LANGUAGE_COOKIE),
      )
      setLanguage(next)
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
  }, [])

  const value = React.useMemo<LanguageContextValue>(
    () => ({
      language,
      t: (key: string) => key,
      dir: languageDir(language),
    }),
    [language],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export const useLanguage = () => {
  return React.useContext(LanguageContext)
}
