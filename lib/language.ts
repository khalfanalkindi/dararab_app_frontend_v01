export const LANGUAGE_COOKIE = "preferredLanguage"
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

export type AppLanguage = "en" | "ar"

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === "en" || value === "ar"
}

export function normalizeLanguage(value: string | null | undefined): AppLanguage {
  return isAppLanguage(value) ? value : "en"
}

export function languageDir(lang: AppLanguage): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr"
}

/** Apply lang/dir on `<html>` (client only). */
export function applyDocumentLanguage(lang: AppLanguage) {
  if (typeof document === "undefined") return
  document.documentElement.lang = lang
  document.documentElement.dir = languageDir(lang)
}

/**
 * Persist language to localStorage + cookie and update `<html>`.
 * Cookie lets the root layout set lang/dir on the first server render.
 */
export function persistLanguage(lang: AppLanguage) {
  applyDocumentLanguage(lang)

  try {
    localStorage.setItem(LANGUAGE_COOKIE, lang)
  } catch {
    // ignore quota / private mode
  }

  if (typeof document !== "undefined") {
    document.cookie = `${LANGUAGE_COOKIE}=${encodeURIComponent(lang)}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; SameSite=Lax`
  }
}

/** Read preferred language from document.cookie (client). */
export function readLanguageCookie(): AppLanguage | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${LANGUAGE_COOKIE}=([^;]*)`))
  if (!match?.[1]) return null
  return normalizeLanguage(decodeURIComponent(match[1]))
}
