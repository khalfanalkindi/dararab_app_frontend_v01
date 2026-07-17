"use client"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

import type { ProductSummary } from "../page"

type DeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
  deleteBookId: number | null
  productSummaries: ProductSummary[]
  onDelete: () => void
  isSubmitting: boolean
}

export function DeleteDialog({
  open,
  onOpenChange,
  onClose,
  deleteBookId,
  productSummaries,
  onDelete,
  isSubmitting,
}: DeleteDialogProps) {
  const book = deleteBookId !== null ? productSummaries.find((b) => b.id === deleteBookId) : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            {deleteBookId !== null && (
              <>
                You are about to delete <strong>{book?.isbn}</strong>. This action cannot be undone. This will permanently
                remove the book from your inventory.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
