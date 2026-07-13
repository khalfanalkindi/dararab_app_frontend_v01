/** Shared helpers for sidebar / account user display + localStorage cache. */

export const USER_DATA_KEY = "userData"

export type SidebarUser = {
  name: string
  email: string
  avatar: string
}

export function displayNameFromUser(data: {
  first_name?: string | null
  last_name?: string | null
  username?: string | null
  name?: string | null
}): string {
  const fromParts = `${data.first_name || ""} ${data.last_name || ""}`.trim()
  if (fromParts) return fromParts
  if (data.name?.trim()) return data.name.trim()
  if (data.username?.trim()) return data.username.trim()
  return "User"
}

export function mapToSidebarUser(data: Record<string, unknown>): SidebarUser {
  return {
    name: displayNameFromUser({
      first_name: typeof data.first_name === "string" ? data.first_name : null,
      last_name: typeof data.last_name === "string" ? data.last_name : null,
      username: typeof data.username === "string" ? data.username : null,
      name: typeof data.name === "string" ? data.name : null,
    }),
    email:
      (typeof data.email === "string" && data.email) ||
      (typeof data.username === "string" && data.username) ||
      "",
    avatar: typeof data.avatar === "string" ? data.avatar : "",
  }
}

export function readCachedUserData(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function readCachedSidebarUser(): SidebarUser | null {
  const cached = readCachedUserData()
  return cached ? mapToSidebarUser(cached) : null
}

/** Merge API/login user payload into localStorage `userData`. */
export function cacheUserData(data: Record<string, unknown>) {
  try {
    const existing = readCachedUserData() || {}
    const next = {
      ...existing,
      ...data,
      name: displayNameFromUser({
        first_name:
          typeof data.first_name === "string"
            ? data.first_name
            : typeof existing.first_name === "string"
              ? existing.first_name
              : null,
        last_name:
          typeof data.last_name === "string"
            ? data.last_name
            : typeof existing.last_name === "string"
              ? existing.last_name
              : null,
        username:
          typeof data.username === "string"
            ? data.username
            : typeof existing.username === "string"
              ? existing.username
              : null,
        name: typeof data.name === "string" ? data.name : null,
      }),
    }
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(next))
  } catch {
    // ignore quota / private mode
  }
}
