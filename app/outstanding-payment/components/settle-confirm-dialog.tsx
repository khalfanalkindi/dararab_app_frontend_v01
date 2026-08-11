"use client"

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
import { Loader2 } from "lucide-react"
import { useLanguage } from "@/components/language-context"
import { formatInvoiceUsdAmount } from "@/lib/muscatCurrency"
import type { Invoice, Warehouse } from "./types"

type SettleConfirmDialogProps = {
  open: boolean
  invoice: Invoice | null
  warehouses: Warehouse[]
  isSettling: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function SettleConfirmDialog({
  open,
  invoice,
  warehouses,
  isSettling,
  onOpenChange,
  onConfirm,
}: SettleConfirmDialogProps) {
  const { t } = useLanguage()

  if (!invoice) return null

  const invoiceId = invoice.composite_id || String(invoice.id)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isSettling) return
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("outstanding.settle.confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("outstanding.settle.confirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t("outstanding.table.invoiceId")}</span>
            <span className="font-medium">#{invoiceId}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t("outstanding.table.customer")}</span>
            <span className="font-medium text-right">
              {invoice.customer_name || t("outstanding.table.noCustomer")}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t("outstanding.table.warehouse")}</span>
            <span className="font-medium text-right">
              {invoice.warehouse_name || t("outstanding.table.noWarehouse")}
            </span>
          </div>
          <div className="flex justify-between gap-4 border-t pt-2">
            <span className="text-muted-foreground">{t("outstanding.table.outstanding")}</span>
            <span className="font-semibold text-red-600">
              {formatInvoiceUsdAmount(invoice.remaining_amount || 0, invoice, warehouses)}
            </span>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSettling}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={isSettling}
          >
            {isSettling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("common.loading")}
              </>
            ) : (
              t("outstanding.settle.confirm")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
