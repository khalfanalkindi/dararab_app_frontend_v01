"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ReceiptContent } from "@/components/receipt/ReceiptContent"
import type { ReceiptData } from "@/components/receipt/ReceiptContent"
import { Loader2 } from "lucide-react"
import { useLanguage } from "@/components/language-context"

type InvoiceReceiptDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  receiptPayload: ReceiptData | null
  isLoading: boolean
  onClose: () => void
}

export function InvoiceReceiptDialog({
  open,
  onOpenChange,
  receiptPayload,
  isLoading,
  onClose,
}: InvoiceReceiptDialogProps) {
  const { t } = useLanguage()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-md flex-col gap-0 overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0 space-y-1 pb-2">
          <DialogTitle>{t("invoices.receipt.title")}</DialogTitle>
          <DialogDescription>{t("invoices.receipt.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          {isLoading && !receiptPayload ? (
            <div className="flex flex-1 items-center justify-center gap-2 py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>{t("invoices.receipt.loading")}</span>
            </div>
          ) : receiptPayload ? (
            <ReceiptContent
              receiptData={receiptPayload}
              currencyLabel="$"
              getDisplayPrice={() => null}
              onClose={onClose}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
