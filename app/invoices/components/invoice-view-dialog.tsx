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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice Details</DialogTitle>
          <DialogDescription>
            Invoice #{invoice?.invoice_number} - {invoice?.customer?.institution_name || "No Customer"}
          </DialogDescription>
        </DialogHeader>

        {invoice && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-2">Customer Information</h3>
                <p>{invoice.customer?.institution_name || "No Customer"}</p>
                <p className="text-sm text-muted-foreground">
                  {invoice.customer?.contact_person || "No Contact Person"}
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-2">Invoice Information</h3>
                <p>Invoice #: {invoice.invoice_number}</p>
                <p>Composite ID: {invoice.composite_id || "N/A"}</p>
                <p>
                  Date:{" "}
                  {invoice.created_at ? format(new Date(invoice.created_at), "PPP") : "No Date"}
                </p>
                <p>Warehouse: {invoice.warehouse?.name_en || "No Warehouse"}</p>
                <p>Type: {invoice.invoice_type?.display_name_en || "No Type"}</p>
                <p>Payment Method: {invoice.payment_method?.display_name_en || "No Payment Method"}</p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-medium mb-4">Items</h3>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.product?.title_en || "No Title"}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.product?.title_ar || "No Arabic Title"}
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
                          No items found
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
                        TOTAL:
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
                <h3 className="font-medium mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-md">
                  {invoice.notes}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
