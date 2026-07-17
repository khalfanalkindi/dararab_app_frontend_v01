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
import { useLanguage } from "@/components/language-context"

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
  const { t } = useLanguage()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("invoices.delete.title")}</DialogTitle>
          <DialogDescription>
            {t("invoices.delete.description")}
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm font-medium text-yellow-800 mb-1">{t("invoices.delete.important")}</p>
              <p className="text-sm text-yellow-700">
                {t("invoices.delete.returnStock")}{" "}
                ({invoice?.warehouse?.name_en || t("outstanding.table.noWarehouse")})
              </p>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">{t("invoices.view.invoiceInfo")}:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  {t("invoices.table.invoiceNumber")}: {invoice?.invoice_number || t("common.na")}
                </li>
                <li>
                  {t("invoices.table.compositeId")}: {invoice?.composite_id || t("common.na")}
                </li>
                <li>
                  {t("common.customer")}:{" "}
                  {invoice?.customer?.institution_name || t("outstanding.table.noCustomer")}
                </li>
                <li>
                  {t("common.date")}:{" "}
                  {invoice?.created_at
                    ? format(new Date(invoice.created_at), "PPP")
                    : t("outstanding.table.noDate")}
                </li>
                <li>
                  {t("invoices.table.amount")}: {(invoice?.total_amount || 0).toFixed(3)} $
                </li>
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">{t("invoices.delete.typeDelete")}:</p>
              <Input
                value={deleteConfirmation}
                onChange={(e) => onDeleteConfirmationChange(e.target.value)}
                placeholder={t("invoices.delete.placeholder")}
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
              <p className="text-sm">{t("invoices.delete.code")}: {deleteError.code}</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm underline underline-offset-2"
                onClick={onToggleDeleteErrorDetails}
              >
                {showDeleteErrorDetails ? t("invoices.delete.hideDetails") : t("invoices.delete.viewDetails")}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showDeleteErrorDetails ? "rotate-180" : ""}`}
                />
              </button>
              {showDeleteErrorDetails && (
                <div className="mt-2 max-h-40 overflow-auto rounded border border-destructive/30 bg-background/50 p-2 text-xs font-mono whitespace-pre-wrap">
                  <div>{deleteError.detail}</div>
                  {deleteError.product_ids.length > 0 && (
                    <div className="mt-2">{t("invoices.delete.productIds")}: {deleteError.product_ids.join(", ")}</div>
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
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={deleteConfirmation !== "DELETE" || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("common.loading")}
              </>
            ) : (
              t("invoices.delete.confirm")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
