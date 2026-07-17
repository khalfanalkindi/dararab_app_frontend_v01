/**
 * Parse standardized API error bodies:
 *   { detail, code, field_errors, ...extras }
 * Also tolerates legacy DRF shapes (message, non_field_errors, bare field maps).
 */

export type ApiFieldErrors = Record<string, string[]>

export type ApiErrorBody = {
  detail?: string
  code?: string
  field_errors?: ApiFieldErrors
  message?: string
  error?: string
  non_field_errors?: string[] | string
  [key: string]: unknown
}

export type ParsedApiError = {
  detail: string
  code: string
  field_errors: ApiFieldErrors
  raw: ApiErrorBody
}

function asStringList(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item != null && typeof item === "object" && "detail" in item) {
        return String((item as { detail: unknown }).detail)
      }
      return String(item)
    })
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      asStringList(v).map((msg) => (k === "non_field_errors" ? msg : `${k}: ${msg}`)),
    )
  }
  return [String(value)]
}

function firstFieldMessage(fieldErrors: ApiFieldErrors): string | null {
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (!messages?.length) continue
    if (field === "non_field_errors") return messages[0]
    return `${field}: ${messages[0]}`
  }
  return null
}

const META_KEYS = new Set([
  "detail",
  "code",
  "field_errors",
  "message",
  "error",
  "pages",
  "path",
  "action",
  "product_ids",
  "errors",
  "succeeded",
  "failed",
  "success_count",
  "failed_count",
  "total_requested",
  "mode",
])

/** Normalize any JSON error body into { detail, code, field_errors }. */
export function parseApiErrorBody(
  body: unknown,
  fallbackDetail = "Request failed.",
): ParsedApiError {
  if (body == null || typeof body !== "object") {
    return {
      detail: typeof body === "string" && body ? body : fallbackDetail,
      code: "ERROR",
      field_errors: {},
      raw: {},
    }
  }

  if (Array.isArray(body)) {
    const messages = asStringList(body)
    return {
      detail: messages.join("; ") || fallbackDetail,
      code: "ERROR",
      field_errors: { non_field_errors: messages },
      raw: {},
    }
  }

  const raw = body as ApiErrorBody
  const field_errors: ApiFieldErrors = {}

  if (raw.field_errors && typeof raw.field_errors === "object" && !Array.isArray(raw.field_errors)) {
    for (const [k, v] of Object.entries(raw.field_errors)) {
      field_errors[k] = asStringList(v)
    }
  }

  if (raw.non_field_errors != null) {
    field_errors.non_field_errors = asStringList(raw.non_field_errors)
  }

  for (const [key, value] of Object.entries(raw)) {
    if (META_KEYS.has(key) || key === "non_field_errors") continue
    // Legacy DRF validation: { email: ["required"] }
    if (Array.isArray(value) || (typeof value === "string" && key !== "code")) {
      if (typeof value === "string" && ["detail", "message", "error"].includes(key)) continue
      if (Array.isArray(value) || typeof value === "string") {
        // Skip non-message arrays (e.g. product_ids already in META)
        if (Array.isArray(value) && value.length && typeof value[0] !== "string" && typeof value[0] !== "object") {
          continue
        }
        if (!(key in field_errors)) {
          field_errors[key] = asStringList(value)
        }
      }
    }
  }

  let detail =
    (typeof raw.detail === "string" && raw.detail) ||
    (typeof raw.message === "string" && raw.message) ||
    (typeof raw.error === "string" && raw.error) ||
    firstFieldMessage(field_errors) ||
    fallbackDetail

  if (Array.isArray(raw.detail)) {
    detail = asStringList(raw.detail).join("; ") || fallbackDetail
  }

  const code =
    typeof raw.code === "string" && raw.code
      ? raw.code
      : field_errors && Object.keys(field_errors).length
        ? "VALIDATION_ERROR"
        : "ERROR"

  return { detail, code, field_errors, raw }
}

/** Short user-facing message (detail, optionally first field error). */
export function formatApiErrorMessage(
  body: unknown,
  fallbackDetail = "Request failed.",
): string {
  return parseApiErrorBody(body, fallbackDetail).detail
}

/** Read JSON from a failed Response and return a user-facing message. */
export async function readApiErrorMessage(
  res: Response,
  fallbackDetail = "Request failed.",
): Promise<string> {
  const ct = res.headers.get("content-type") || ""
  if (ct.includes("application/json")) {
    const body = await res.json().catch(() => null)
    return formatApiErrorMessage(body, fallbackDetail)
  }
  const text = await res.text().catch(() => "")
  if (text) return text.slice(0, 300)
  return `${fallbackDetail} (${res.status})`
}
