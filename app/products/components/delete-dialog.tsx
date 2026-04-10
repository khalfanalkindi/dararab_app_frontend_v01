"use client"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import type { ProductSummary } from "../page"

type DeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
  deleteBookId: number | null
  productSummaries: ProductSummary[]
  deleteConfirm: string
  setDeleteConfirm: (value: string) => void
  onDelete: () => void
  isSubmitting: boolean
}

export function DeleteDialog({
  open,
  onOpenChange,
  onClose,
  deleteBookId,
  productSummaries,
  deleteConfirm,
  setDeleteConfirm,
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
                <div className="mt-4">
                  <Label htmlFor="confirm-delete">Type "DELETE" to confirm</Label>
                  <Input
                    id="confirm-delete"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    className="mt-2"
                  />
                </div>
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
            disabled={deleteConfirm !== "DELETE" || isSubmitting}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


