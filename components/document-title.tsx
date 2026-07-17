"use client"

import { useEffect } from "react"

const APP_SUFFIX = "DarArab"

/**
 * Sets `document.title` for client pages (most app routes are `"use client"`).
 * Prefer: `<DocumentTitle title="Invoices" />` → "Invoices | DarArab"
 */
export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} | ${APP_SUFFIX}` : APP_SUFFIX
    return () => {
      document.title = previous
    }
  }, [title])

  return null
}
