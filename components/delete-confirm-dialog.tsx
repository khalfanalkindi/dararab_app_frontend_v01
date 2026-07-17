"use client"

import { useEffect, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/components/language-context"

export const DELETE_CONFIRM_WORD = "DELETE"

type DeleteConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  /** Entity description — shown above the confirm controls */
  description: React.ReactNode
  /**
   * `typed` — require typing DELETE (invoices / irreversible financial deletes).
   * `simple` — Cancel / Delete only (default for admin, definitions, catalog).
   */
  mode?: "simple" | "typed"
  isDeleting?: boolean
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
}

/**
 * Shared delete confirmation.
 * Prefer `mode="simple"` for day-to-day CRUD; reserve `typed` for high-stakes deletes.
 */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  mode = "simple",
  isDeleting = false,
  confirmLabel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const { t } = useLanguage()
  const resolvedTitle = title ?? t("common.areYouSure")
  const resolvedConfirmLabel = confirmLabel ?? t("common.delete")
  const [typedValue, setTypedValue] = useState("")
  const requiresTyped = mode === "typed"
  const canConfirm = !isDeleting && (!requiresTyped || typedValue === DELETE_CONFIRM_WORD)

  useEffect(() => {
    if (!open) {
      setTypedValue("")
    }
  }, [open])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{resolvedTitle}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div>{description}</div>
              {requiresTyped && (
                <div>
                  <Label htmlFor="confirm-delete" className="text-foreground">
                    {t("common.typeDeleteToConfirm", { word: DELETE_CONFIRM_WORD })}
                  </Label>
                  <Input
                    id="confirm-delete"
                    value={typedValue}
                    onChange={(e) => setTypedValue(e.target.value)}
                    className="mt-2"
                    placeholder={DELETE_CONFIRM_WORD}
                    autoComplete="off"
                    disabled={isDeleting}
                  />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={!canConfirm}
            onClick={(e) => {
              e.preventDefault()
              void onConfirm()
            }}
          >
            {isDeleting ? "Deleting..." : resolvedConfirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
