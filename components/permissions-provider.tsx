"use client"

import * as React from "react"
import { API_URL } from "@/lib/config"
import {
  type PermissionAction,
  type PermissionsPayload,
  canAccessPath,
  firstAllowedPath,
} from "@/lib/permissions"

type PermissionsContextValue = {
  permissions: PermissionsPayload | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  can: (path: string, action?: PermissionAction) => boolean
  firstAllowedPath: () => string
}

const PermissionsContext = React.createContext<PermissionsContextValue | null>(null)

const STORAGE_KEY = "userPermissions"

function readCached(): PermissionsPayload | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PermissionsPayload
  } catch {
    return null
  }
}

function writeCached(payload: PermissionsPayload | null) {
  if (typeof window === "undefined") return
  if (!payload) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function clearCachedPermissions() {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = React.useState<PermissionsPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    const token = localStorage.getItem("accessToken")
    if (!token) {
      setPermissions(null)
      writeCached(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/auth/my-permissions/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (res.status === 401) {
        setPermissions(null)
        writeCached(null)
        setError("Unauthorized")
        return
      }
      if (!res.ok) {
        throw new Error(`Failed to load permissions (${res.status})`)
      }
      const data = (await res.json()) as PermissionsPayload
      setPermissions(data)
      writeCached(data)
    } catch (err) {
      const cached = readCached()
      if (cached) {
        setPermissions(cached)
      }
      setError(err instanceof Error ? err.message : "Failed to load permissions")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const cached = readCached()
    if (cached) setPermissions(cached)

    const token = localStorage.getItem("accessToken")
    if (!token) {
      setLoading(false)
      return
    }
    void refresh()
  }, [refresh])

  const value = React.useMemo<PermissionsContextValue>(
    () => ({
      permissions,
      loading,
      error,
      refresh,
      can: (path, action = "can_view") => canAccessPath(permissions, path, action),
      firstAllowedPath: () => firstAllowedPath(permissions),
    }),
    [permissions, loading, error, refresh],
  )

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions() {
  const ctx = React.useContext(PermissionsContext)
  if (!ctx) {
    throw new Error("usePermissions must be used within PermissionsProvider")
  }
  return ctx
}

/** Safe hook when provider may be missing (e.g. login page). */
export function usePermissionsOptional() {
  return React.useContext(PermissionsContext)
}
