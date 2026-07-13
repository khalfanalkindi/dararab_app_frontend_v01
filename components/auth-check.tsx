"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { PermissionsProvider, usePermissionsOptional, clearCachedPermissions } from "@/components/permissions-provider"
import { AuthLoading } from "@/components/auth-loading"
import {
  PUBLIC_PATHS,
  ALWAYS_ALLOWED_PATHS,
  canAccessPath,
  normalizePath,
} from "@/lib/permissions"
import {
  LANGUAGE_COOKIE,
  normalizeLanguage,
  persistLanguage,
  readLanguageCookie,
} from "@/lib/language"

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const perms = usePermissionsOptional()
  const [isLoading, setIsLoading] = useState(true)
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    setHasToken(Boolean(localStorage.getItem("accessToken")))
  }, [pathname, perms?.loading, perms?.permissions])

  useEffect(() => {
    // Prefer localStorage, fall back to cookie; keep both in sync for SSR lang/dir.
    const fromStorage = localStorage.getItem(LANGUAGE_COOKIE)
    const fromCookie = readLanguageCookie()
    const lang = normalizeLanguage(fromStorage ?? fromCookie)
    persistLanguage(lang)

    const authToken = localStorage.getItem("accessToken")
    const isAuthenticated = !!authToken
    const path = normalizePath(pathname || "/")

    if (!isAuthenticated && path !== "/login") {
      router.replace("/login")
      setIsLoading(false)
      return
    }

    // Home and login both land authenticated users on their first allowed page
    if (isAuthenticated && (path === "/" || path === "/login")) {
      if (perms?.loading && !perms.permissions) {
        return
      }
      const landing = perms?.firstAllowedPath() || "/dashboard"
      router.replace(landing)
      setIsLoading(false)
      return
    }

    const skipPermCheck =
      path === "/login" ||
      PUBLIC_PATHS.includes(path as (typeof PUBLIC_PATHS)[number]) ||
      ALWAYS_ALLOWED_PATHS.includes(path as (typeof ALWAYS_ALLOWED_PATHS)[number])

    if (isAuthenticated && !skipPermCheck) {
      // Wait only for the first permissions load (no cache yet).
      if (perms?.loading && !perms.permissions) {
        return
      }

      const payload = perms?.permissions ?? null
      // Fail-open when payload is missing (API error / not loaded) so users are not
      // redirected to dashboard on every navigation.
      if (payload && !canAccessPath(payload, path, "can_view")) {
        const fallback = perms?.firstAllowedPath() || "/dashboard"
        if (fallback !== path) {
          router.replace(fallback)
          setIsLoading(false)
          return
        }
      }
    }

    setIsLoading(false)
  }, [router, pathname, perms, perms?.loading, perms?.permissions])

  const path = normalizePath(pathname || "/")
  const waitingForPerms =
    hasToken && Boolean(perms?.loading) && !perms?.permissions && path !== "/login"

  if (isLoading || waitingForPerms) {
    return <AuthLoading />
  }

  return <>{children}</>
}

export function AuthCheck({ children }: { children: React.ReactNode }) {
  return (
    <PermissionsProvider>
      <AuthGate>{children}</AuthGate>
    </PermissionsProvider>
  )
}

export { clearCachedPermissions }
