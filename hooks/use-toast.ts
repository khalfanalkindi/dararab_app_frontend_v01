"use client"

/**
 * Compatibility shim: shadcn-style toast({ title, description, variant })
 * now routes to Sonner (mounted in app/layout via components/ui/sonner).
 *
 * Prefer `import { toast } from "sonner"` + toast.success / toast.error for new code.
 */

import { toast as sonnerToast } from "sonner"
import type { ReactNode } from "react"

type ToastInput = {
  title?: ReactNode
  description?: ReactNode
  variant?: "default" | "destructive"
}

function toText(value: ReactNode | undefined): string {
  if (value == null || value === false) return ""
  if (typeof value === "string" || typeof value === "number") return String(value)
  return String(value)
}

/** @deprecated Prefer `import { toast } from "sonner"` */
function toast({ title, description, variant }: ToastInput = {}) {
  const message = toText(title)
  const desc = toText(description)
  const options = desc ? { description: desc } : undefined

  if (variant === "destructive") {
    return sonnerToast.error(message || desc || "Error", desc && message ? options : undefined)
  }

  if (message) {
    return sonnerToast.success(message, options)
  }
  if (desc) {
    return sonnerToast(desc)
  }
  return sonnerToast("Notification")
}

/** @deprecated Prefer sonner directly */
function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    toasts: [] as { id: string }[],
  }
}

export { useToast, toast }
