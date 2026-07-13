"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react"
import { format } from "date-fns"

import type { DeleteErrorPayload, Invoice } from "./types"

type InvoiceDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice | null
  deleteConfirmation: string
  onDeleteConfirmationChange: (value: string) => void
  deleteError: DeleteErrorPayload | null
  showDeleteErrorDetails: boolean
  onToggleDeleteErrorDetails: () => void
  isDeleting: boolean
  onCancel: () => void
  onDelete: () => void
}

export function InvoiceDeleteDialog({
  open,
  onOpenChange,
  invoice,
  deleteConfirmation,
  onDeleteConfirmationChange,
  deleteError,
  showDeleteErrorDetails,
  onToggleDeleteErrorDetails,
  isDeleting,
  onCancel,
  onDelete,
}: InvoiceDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Invoice</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this invoice? This action cannot be undone.
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm font-medium text-yellow-800 mb-1">Important</p>
              <p className="text-sm text-yellow-700">
                All items from this invoice will be returned to the warehouse (
                {invoice?.warehouse?.name_en || "Unknown Warehouse"}) when you delete.
              </p>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Invoice Details:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Invoice #: {invoice?.invoice_number || "N/A"}</li>
                <li>Composite ID: {invoice?.composite_id || "N/A"}</li>
                <li>Customer: {invoice?.customer?.institution_name || "No Customer"}</li>
                <li>
                  Date:{" "}
                  {invoice?.created_at ? format(new Date(invoice.created_at), "PPP") : "No Date"}
                </li>
                <li>Amount: {(invoice?.total_amount || 0).toFixed(3)} $</li>
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Type DELETE to confirm:</p>
              <Input
                value={deleteConfirmation}
                onChange={(e) => onDeleteConfirmationChange(e.target.value)}
                placeholder="Type DELETE"
                className="w-full"
              />
            </div>
          </DialogDescription>
        </DialogHeader>

        {deleteError && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{deleteError.message}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="text-sm">Code: {deleteError.code}</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm underline underline-offset-2"
                onClick={onToggleDeleteErrorDetails}
              >
                {showDeleteErrorDetails ? "Hide details" : "View details"}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showDeleteErrorDetails ? "rotate-180" : ""}`}
                />
              </button>
              {showDeleteErrorDetails && (
                <div className="mt-2 max-h-40 overflow-auto rounded border border-destructive/30 bg-background/50 p-2 text-xs font-mono whitespace-pre-wrap">
                  <div>{deleteError.detail}</div>
                  {deleteError.product_ids.length > 0 && (
                    <div className="mt-2">Product IDs: {deleteError.product_ids.join(", ")}</div>
                  )}
                  {deleteError.errors.length > 0 && (
                    <div className="mt-2">{JSON.stringify(deleteError.errors, null, 2)}</div>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={deleteConfirmation !== "DELETE" || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Invoice"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
