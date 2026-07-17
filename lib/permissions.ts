export type PagePermission = {
  page_id: number
  name: string
  name_ar?: string | null
  url: string
  can_view: boolean
  can_add: boolean
  can_edit: boolean
  can_delete: boolean
  source?: "role" | "user"
}

export type PermissionsPayload = {
  user_id: number
  role: { id: number; name: string; name_ar?: string | null } | null
  unrestricted: boolean
  permissions: PagePermission[]
}

export type PermissionAction = "can_view" | "can_add" | "can_edit" | "can_delete"

export const PUBLIC_PATHS = ["/login"] as const

/** Always reachable when logged in (profile), even without a Page row. */
export const ALWAYS_ALLOWED_PATHS = ["/account", "/receipt"] as const

export function normalizePath(path: string): string {
  if (!path) return "/"
  let p = path.split("?")[0].split("#")[0]
  if (!p.startsWith("/")) p = `/${p}`
  if (p.length > 1 && p.endsWith("/")) p = p.replace(/\/+$/, "")
  return p || "/"
}

export function canAccessPath(
  payload: PermissionsPayload | null | undefined,
  path: string,
  action: PermissionAction = "can_view",
): boolean {
  const normalized = normalizePath(path)

  if (PUBLIC_PATHS.includes(normalized as (typeof PUBLIC_PATHS)[number])) {
    return true
  }
  if (ALWAYS_ALLOWED_PATHS.includes(normalized as (typeof ALWAYS_ALLOWED_PATHS)[number])) {
    return true
  }
  if (!payload) return false
  if (payload.unrestricted) return true

  // No page grants configured yet → fail-open (same spirit as empty Page table on BE)
  if (!payload.permissions?.length) return true

  const exact = payload.permissions.find((p) => normalizePath(p.url) === normalized)
  if (exact?.[action]) return true

  // Parent path allowed if any child page under it is allowed
  // e.g. /admin allowed when /admin/users has can_view
  const childAllowed = payload.permissions.some((p) => {
    const url = normalizePath(p.url)
    return url.startsWith(`${normalized}/`) && Boolean(p[action])
  })
  if (childAllowed) return true

  return false
}

export function filterNavByPermissions<
  T extends { url: string; items?: { url: string; title: string }[] },
>(items: T[], payload: PermissionsPayload | null | undefined): T[] {
  if (!payload || payload.unrestricted) return items

  return items
    .map((item) => {
      if (item.items && item.items.length > 0) {
        const children = item.items.filter((sub) => canAccessPath(payload, sub.url, "can_view"))
        if (children.length === 0 && !canAccessPath(payload, item.url, "can_view")) {
          return null
        }
        return { ...item, items: children }
      }
      return canAccessPath(payload, item.url, "can_view") ? item : null
    })
    .filter(Boolean) as T[]
}

export function filterAdminNavByPermissions<
  T extends { url: string; items?: { url: string; title: string }[] },
>(projects: T[], payload: PermissionsPayload | null | undefined): T[] {
  if (!payload || payload.unrestricted) return projects

  return projects
    .map((item) => {
      if (item.items && item.items.length > 0) {
        const children = item.items.filter((sub) => canAccessPath(payload, sub.url, "can_view"))
        if (children.length === 0) return null
        return { ...item, items: children }
      }
      return canAccessPath(payload, item.url, "can_view") ? item : null
    })
    .filter(Boolean) as T[]
}

export function firstAllowedPath(payload: PermissionsPayload | null | undefined): string {
  if (!payload || payload.unrestricted) return "/dashboard"
  const viewable = payload.permissions.find((p) => p.can_view && p.url)
  return viewable ? normalizePath(viewable.url) : "/account"
}
