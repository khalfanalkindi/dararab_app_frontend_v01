"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import { useLanguage } from "@/components/language-context"

import type { Invoice, InvoiceTotals } from "./types"

type InvoiceViewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice | null
  invoiceTotals: InvoiceTotals
  onClose: () => void
}

export function InvoiceViewDialog({
  open,
  onOpenChange,
  invoice,
  invoiceTotals,
  onClose,
}: InvoiceViewDialogProps) {
  const { t } = useLanguage()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("invoices.view.title")}</DialogTitle>
          <DialogDescription>
            {t("invoices.table.invoiceNumber")} {invoice?.invoice_number} -{" "}
            {invoice?.customer?.institution_name || t("outstanding.table.noCustomer")}
          </DialogDescription>
        </DialogHeader>

        {invoice && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-2">{t("invoices.view.customerInfo")}</h3>
                <p>{invoice.customer?.institution_name || t("outstanding.table.noCustomer")}</p>
                <p className="text-sm text-muted-foreground">
                  {invoice.customer?.contact_person || t("common.na")}
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-2">{t("invoices.view.invoiceInfo")}</h3>
                <p>
                  {t("invoices.table.invoiceNumber")}: {invoice.invoice_number}
                </p>
                <p>
                  {t("invoices.table.compositeId")}: {invoice.composite_id || t("common.na")}
                </p>
                <p>
                  {t("common.date")}:{" "}
                  {invoice.created_at
                    ? format(new Date(invoice.created_at), "PPP")
                    : t("outstanding.table.noDate")}
                </p>
                <p>
                  {t("common.warehouse")}: {invoice.warehouse?.name_en || t("outstanding.table.noWarehouse")}
                </p>
                <p>
                  {t("common.type")}: {invoice.invoice_type?.display_name_en || t("common.na")}
                </p>
                <p>
                  {invoice.payment_method?.display_name_en || t("common.na")}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-medium mb-4">{t("invoices.view.items")}</h3>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.product")}</TableHead>
                      <TableHead className="text-right">{t("common.quantity")}</TableHead>
                      <TableHead className="text-right">{t("invoices.view.unitPrice")}</TableHead>
                      <TableHead className="text-right">{t("invoices.view.discount")}</TableHead>
                      <TableHead className="text-right">{t("common.total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.product?.title_en || t("common.na")}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.product?.title_ar || t("common.na")}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity || 0}</TableCell>
                        <TableCell className="text-right">{(item.unit_price || 0).toFixed(3)} $</TableCell>
                        <TableCell className="text-right">{item.discount_percent || 0}%</TableCell>
                        <TableCell className="text-right">{(item.total_price || 0).toFixed(3)} $</TableCell>
                      </TableRow>
                    )) || (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          {t("common.noResults")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-medium">
                        Subtotal:
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {invoiceTotals.subtotal.toFixed(3)} $
                      </TableCell>
                    </TableRow>
                    {invoice.tax_percent && invoiceTotals.taxAmount > 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-right font-medium">
                          Tax ({invoice.tax_percent}%):
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {invoiceTotals.taxAmount.toFixed(3)} $
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow className="border-t-2 border-gray-400">
                      <TableCell colSpan={4} className="text-right font-bold text-lg">
                        {t("common.total")}:
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {invoiceTotals.total.toFixed(3)} $
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-medium">
                        Total Paid:
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {invoiceTotals.totalPaid.toFixed(3)} $
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-medium">
                        Amount Due:
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {invoiceTotals.amountDue.toFixed(3)} $
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>

            {invoice.notes && (
              <div>
                <h3 className="font-medium mb-2">{t("common.notes")}</h3>
                <p className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-md">
                  {invoice.notes}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={onClose}>{t("common.close")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
