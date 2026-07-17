/**
 * Shared authenticated fetch with retry + session handling.
 *
 * - Attaches Bearer accessToken when present
 * - On 401: tries POST /api/auth/token/refresh/ once, retries request
 * - If refresh fails: clears session, toasts, redirects to /login
 * - Retries 5xx / 429 with exponential backoff
 *
 * Note: 403 is NOT treated as session expiry (RBAC page permission denials).
 *
 * Error bodies are standardized by the backend as:
 *   { detail, code, field_errors, ...extras }
 * Prefer `@/lib/apiErrors` (`formatApiErrorMessage`, `readApiErrorMessage`) when parsing failures.
 */

import { API_URL } from "@/lib/config"

export {
  formatApiErrorMessage,
  parseApiErrorBody,
  readApiErrorMessage,
  type ApiErrorBody,
  type ParsedApiError,
} from "@/lib/apiErrors"

export type FetchWithRetryOptions = RequestInit & {
  /** Skip attaching Authorization header (login, refresh). */
  skipAuth?: boolean
  /** Skip 401 refresh/redirect handling. */
  skipSessionHandling?: boolean
}

let redirectingToLogin = false
let refreshPromise: Promise<string | null> | null = null

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("accessToken")
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("refreshToken")
}

export function authHeaders(extra: HeadersInit = {}): HeadersInit {
  const headers = new Headers(extra)
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const token = getAccessToken()
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  return headers
}

export function clearSession() {
  if (typeof window === "undefined") return
  localStorage.removeItem("accessToken")
  localStorage.removeItem("refreshToken")
  localStorage.removeItem("userData")
  localStorage.removeItem("userPermissions")
}

function showSessionExpiredToast() {
  if (typeof window === "undefined") return
  try {
    // Dynamic import avoids circular deps; sonner is mounted in root layout
    void import("sonner").then(({ toast }) => {
      toast.error("Session expired", {
        description: "Please log in again.",
      })
    })
  } catch {
    // ignore
  }
}

export function redirectToLogin(reason: "session" | "manual" = "session") {
  if (typeof window === "undefined") return
  if (window.location.pathname === "/login") return
  if (redirectingToLogin) return
  redirectingToLogin = true
  clearSession()
  if (reason === "session") {
    showSessionExpiredToast()
  }
  window.location.href = "/login"
}

/** Refresh access token using stored refresh token. Returns new access or null. */
export async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null

  // Single-flight: concurrent 401s share one refresh call
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      })
      if (!res.ok) return null
      const data = (await res.json()) as { access?: string; refresh?: string }
      if (!data.access) return null
      localStorage.setItem("accessToken", data.access)
      if (data.refresh) {
        localStorage.setItem("refreshToken", data.refresh)
      }
      return data.access
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

async function handleUnauthorized(
  url: string,
  options: FetchWithRetryOptions,
): Promise<Response | null> {
  if (options.skipSessionHandling) return null
  // Never try to refresh the refresh/login endpoints themselves
  if (
    url.includes("/auth/token/refresh") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/login")
  ) {
    return null
  }

  const newAccess = await refreshAccessToken()
  if (!newAccess) {
    redirectToLogin("session")
    return null
  }

  const headers = new Headers(options.headers || {})
  headers.set("Authorization", `Bearer ${newAccess}`)
  return fetch(url, { ...options, headers })
}

/**
 * Single request with auth header + 401 refresh retry.
 */
export async function fetchWithAuth(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const { skipAuth, skipSessionHandling, ...init } = options
  const headers = skipAuth
    ? new Headers(init.headers || {})
    : (authHeaders(init.headers || {}) as Headers)

  const response = await fetch(url, { ...init, headers })

  if (response.status === 401 && !skipAuth && !skipSessionHandling) {
    const retried = await handleUnauthorized(url, { ...init, headers, skipAuth, skipSessionHandling })
    if (retried) return retried
  }

  return response
}

/**
 * Drop-in replacement for page-local fetchWithRetry helpers.
 * Signature matches existing call sites: (url, options, maxRetries?, baseDelay?)
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
  maxRetries = 3,
  baseDelay = 1000,
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (options.signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError")
      }

      const response = await fetchWithAuth(url, options)

      if (response.ok) {
        return response
      }

      // 401 already handled inside fetchWithAuth (refresh or redirect).
      // Return other 4xx as-is (including 403 RBAC) — do not retry.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response
      }

      if (response.status >= 500 || response.status === 429) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (error instanceof DOMException && error.name === "AbortError") {
        throw error
      }

      if (attempt === maxRetries) {
        break
      }

      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => resolve(), delay)
        if (options.signal) {
          options.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timeoutId)
              reject(new DOMException("The operation was aborted.", "AbortError"))
            },
            { once: true },
          )
        }
      })
    }
  }

  throw lastError || new Error("Request failed after retries")
}
