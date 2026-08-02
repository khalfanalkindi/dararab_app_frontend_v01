"use client"

import { useRef } from "react"
import { format } from "date-fns"
import { Loader2, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useLanguage } from "@/components/language-context"
import { formatInvoiceUsdAmount } from "@/lib/muscatCurrency"
import type { Invoice, InvoiceItem, Warehouse } from "./types"

type CombinedStatementDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoices: Invoice[]
  warehouses: Warehouse[]
  isLoading: boolean
}

function toNum(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const n = parseFloat(String(value ?? "").replace(/,/g, ""))
  return Number.isFinite(n) ? n : 0
}

function itemRemaining(item: InvoiceItem): number {
  if (item.remaining_amount != null) return Math.max(0, toNum(item.remaining_amount))
  return Math.max(0, toNum(item.total_price) - toNum(item.paid_amount))
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    margin: 24px;
    font-size: 12px;
  }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 1px solid #222; padding-bottom: 4px; }
  .meta { margin-bottom: 16px; line-height: 1.5; }
  .meta strong { display: inline-block; min-width: 90px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f3f3f3; }
  td.num, th.num { text-align: right; }
  .invoice-block { margin-bottom: 20px; page-break-inside: avoid; }
  .totals { margin-top: 20px; border-top: 2px solid #111; padding-top: 10px; }
  .totals-row { display: flex; justify-content: space-between; max-width: 320px; margin-left: auto; padding: 3px 0; }
  .totals-row.grand { font-weight: 700; font-size: 14px; }
  .hint { margin-top: 16px; font-size: 11px; color: #555; }
  @media print {
    body { margin: 12mm; }
  }
`

function buildPrintHtml(args: {
  title: string
  customerLabel: string
  customerName: string
  warehouseLabel: string
  warehouseName: string
  contactLabel: string
  contactName: string
  invoicesLabel: string
  invoiceLabel: string
  dateLabel: string
  productLabel: string
  qtyLabel: string
  unitLabel: string
  discountLabel: string
  totalLabel: string
  paidLabel: string
  outstandingLabel: string
  grandTotalLabel: string
  grandPaidLabel: string
  grandOutstandingLabel: string
  viewOnlyHint: string
  invoices: Invoice[]
  warehouses: Warehouse[]
  formatAmount: (amount: number, invoice: Invoice) => string
}): string {
  const first = args.invoices[0]
  const sections = args.invoices
    .map((invoice) => {
      const invoiceId = invoice.composite_id || String(invoice.id)
      const date = invoice.created_at
        ? format(new Date(invoice.created_at), "PPP")
        : "—"
      const rows = (invoice.items || [])
        .map(
          (item) => `
          <tr>
            <td>${item.product_name || "—"}</td>
            <td class="num">${toNum(item.quantity)}</td>
            <td class="num">${args.formatAmount(toNum(item.unit_price), invoice)}</td>
            <td class="num">${toNum(item.discount_percent)}%</td>
            <td class="num">${args.formatAmount(toNum(item.total_price), invoice)}</td>
            <td class="num">${args.formatAmount(toNum(item.paid_amount), invoice)}</td>
            <td class="num">${args.formatAmount(itemRemaining(item), invoice)}</td>
          </tr>`,
        )
        .join("")

      return `
        <div class="invoice-block">
          <h2>${args.invoiceLabel} #${invoiceId} — ${date}</h2>
          <table>
            <thead>
              <tr>
                <th>${args.productLabel}</th>
                <th class="num">${args.qtyLabel}</th>
                <th class="num">${args.unitLabel}</th>
                <th class="num">${args.discountLabel}</th>
                <th class="num">${args.totalLabel}</th>
                <th class="num">${args.paidLabel}</th>
                <th class="num">${args.outstandingLabel}</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="7">—</td></tr>`}</tbody>
          </table>
          <div class="totals-row"><span>${args.totalLabel}</span><span>${args.formatAmount(toNum(invoice.total_amount), invoice)}</span></div>
          <div class="totals-row"><span>${args.paidLabel}</span><span>${args.formatAmount(toNum(invoice.total_paid), invoice)}</span></div>
          <div class="totals-row"><span>${args.outstandingLabel}</span><span>${args.formatAmount(toNum(invoice.remaining_amount), invoice)}</span></div>
        </div>`
    })
    .join("")

  const grandTotal = args.invoices.reduce((s, inv) => s + toNum(inv.total_amount), 0)
  const grandPaid = args.invoices.reduce((s, inv) => s + toNum(inv.total_paid), 0)
  const grandOutstanding = args.invoices.reduce((s, inv) => s + toNum(inv.remaining_amount), 0)
  const fmt = (n: number) => (first ? args.formatAmount(n, first) : n.toFixed(3))

  return `<!DOCTYPE html><html><head><title>${args.title}</title><style>${PRINT_STYLES}</style></head><body>
    <h1>${args.title}</h1>
    <div class="meta">
      <div><strong>${args.customerLabel}:</strong> ${args.customerName}</div>
      <div><strong>${args.contactLabel}:</strong> ${args.contactName}</div>
      <div><strong>${args.warehouseLabel}:</strong> ${args.warehouseName}</div>
      <div><strong>${args.invoicesLabel}:</strong> ${args.invoices.length}</div>
    </div>
    ${sections}
    <div class="totals">
      <div class="totals-row"><span>${args.grandTotalLabel}</span><span>${fmt(grandTotal)}</span></div>
      <div class="totals-row"><span>${args.grandPaidLabel}</span><span>${fmt(grandPaid)}</span></div>
      <div class="totals-row grand"><span>${args.grandOutstandingLabel}</span><span>${fmt(grandOutstanding)}</span></div>
    </div>
    <p class="hint">${args.viewOnlyHint}</p>
  </body></html>`
}

export function CombinedStatementDialog({
  open,
  onOpenChange,
  invoices,
  warehouses,
  isLoading,
}: CombinedStatementDialogProps) {
  const { t } = useLanguage()
  const printRef = useRef<HTMLDivElement>(null)

  const first = invoices[0]
  const grandTotal = invoices.reduce((s, inv) => s + toNum(inv.total_amount), 0)
  const grandPaid = invoices.reduce((s, inv) => s + toNum(inv.total_paid), 0)
  const grandOutstanding = invoices.reduce((s, inv) => s + toNum(inv.remaining_amount), 0)

  const formatAmount = (amount: number, invoice: Invoice) =>
    formatInvoiceUsdAmount(amount, invoice, warehouses)

  const handlePrint = () => {
    if (!invoices.length) return
    const html = buildPrintHtml({
      title: t("outstanding.combined.title"),
      customerLabel: t("outstanding.table.customer"),
      customerName: first?.customer_name || t("outstanding.table.noCustomer"),
      warehouseLabel: t("outstanding.table.warehouse"),
      warehouseName: first?.warehouse_name || t("outstanding.table.noWarehouse"),
      contactLabel: t("outstanding.combined.contact"),
      contactName: first?.customer_contact || t("common.na"),
      invoicesLabel: t("outstanding.combined.invoiceCount"),
      invoiceLabel: t("outstanding.combined.invoice"),
      dateLabel: t("outstanding.table.date"),
      productLabel: t("outstanding.combined.product"),
      qtyLabel: t("outstanding.combined.qty"),
      unitLabel: t("outstanding.combined.unitPrice"),
      discountLabel: t("outstanding.combined.discount"),
      totalLabel: t("outstanding.table.totalAmount"),
      paidLabel: t("outstanding.table.paidAmount"),
      outstandingLabel: t("outstanding.table.outstanding"),
      grandTotalLabel: t("outstanding.combined.grandTotal"),
      grandPaidLabel: t("outstanding.combined.grandPaid"),
      grandOutstandingLabel: t("outstanding.combined.grandOutstanding"),
      viewOnlyHint: t("outstanding.combined.viewOnlyHint"),
      invoices,
      warehouses,
      formatAmount,
    })

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000")
    if (!printWindow) return
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    const trigger = () => {
      printWindow.focus()
      printWindow.print()
    }
    if (printWindow.document.readyState === "complete") {
      trigger()
    } else {
      printWindow.onload = trigger
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-4xl flex-col gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 space-y-1 pb-2">
          <DialogTitle>{t("outstanding.combined.title")}</DialogTitle>
          <DialogDescription>{t("outstanding.combined.description")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("outstanding.combined.loading")}
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {t("outstanding.combined.empty")}
            </div>
          ) : (
            <div ref={printRef} className="space-y-6 p-1">
              <div className="rounded-md border bg-muted/40 p-4 text-sm space-y-1">
                <p>
                  <span className="font-medium">{t("outstanding.table.customer")}: </span>
                  {first?.customer_name || t("outstanding.table.noCustomer")}
                </p>
                <p>
                  <span className="font-medium">{t("outstanding.combined.contact")}: </span>
                  {first?.customer_contact || t("common.na")}
                </p>
                <p>
                  <span className="font-medium">{t("outstanding.table.warehouse")}: </span>
                  {first?.warehouse_name || t("outstanding.table.noWarehouse")}
                </p>
                <p>
                  <span className="font-medium">{t("outstanding.combined.invoiceCount")}: </span>
                  {invoices.length}
                </p>
              </div>

              {invoices.map((invoice) => {
                const invoiceId = invoice.composite_id || String(invoice.id)
                return (
                  <div key={invoice.id} className="space-y-2 border-b pb-4 last:border-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold">
                        {t("outstanding.combined.invoice")} #{invoiceId}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {invoice.created_at
                          ? format(new Date(invoice.created_at), "PPP")
                          : t("outstanding.table.noDate")}
                      </span>
                    </div>

                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("outstanding.combined.product")}</TableHead>
                            <TableHead className="text-right">{t("outstanding.combined.qty")}</TableHead>
                            <TableHead className="text-right">{t("outstanding.combined.unitPrice")}</TableHead>
                            <TableHead className="text-right">{t("outstanding.combined.discount")}</TableHead>
                            <TableHead className="text-right">{t("outstanding.table.totalAmount")}</TableHead>
                            <TableHead className="text-right">{t("outstanding.table.paidAmount")}</TableHead>
                            <TableHead className="text-right">{t("outstanding.table.outstanding")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(invoice.items || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground">
                                {t("outstanding.dialog.noItems")}
                              </TableCell>
                            </TableRow>
                          ) : (
                            (invoice.items || []).map((item, idx) => (
                              <TableRow key={item.id ?? `${invoice.id}-${idx}`}>
                                <TableCell>{item.product_name || t("common.na")}</TableCell>
                                <TableCell className="text-right">{toNum(item.quantity)}</TableCell>
                                <TableCell className="text-right">
                                  {formatAmount(toNum(item.unit_price), invoice)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {toNum(item.discount_percent)}%
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatAmount(toNum(item.total_price), invoice)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatAmount(toNum(item.paid_amount), invoice)}
                                </TableCell>
                                <TableCell className="text-right font-medium text-red-600">
                                  {formatAmount(itemRemaining(item), invoice)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex flex-wrap justify-end gap-4 text-sm">
                      <span>
                        {t("outstanding.table.totalAmount")}:{" "}
                        <strong>{formatAmount(toNum(invoice.total_amount), invoice)}</strong>
                      </span>
                      <span>
                        {t("outstanding.table.paidAmount")}:{" "}
                        <strong>{formatAmount(toNum(invoice.total_paid), invoice)}</strong>
                      </span>
                      <span className="text-red-600">
                        {t("outstanding.table.outstanding")}:{" "}
                        <strong>{formatAmount(toNum(invoice.remaining_amount), invoice)}</strong>
                      </span>
                    </div>
                  </div>
                )
              })}

              <div className="rounded-md border bg-primary/5 p-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{t("outstanding.combined.grandTotal")}</span>
                  <strong>{first ? formatAmount(grandTotal, first) : grandTotal.toFixed(3)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>{t("outstanding.combined.grandPaid")}</span>
                  <strong>{first ? formatAmount(grandPaid, first) : grandPaid.toFixed(3)}</strong>
                </div>
                <div className="flex justify-between text-base text-red-600">
                  <span>{t("outstanding.combined.grandOutstanding")}</span>
                  <strong>
                    {first ? formatAmount(grandOutstanding, first) : grandOutstanding.toFixed(3)}
                  </strong>
                </div>
                <p className="pt-2 text-xs text-muted-foreground">
                  {t("outstanding.combined.viewOnlyHint")}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t pt-3 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          <Button onClick={handlePrint} disabled={isLoading || invoices.length === 0}>
            <Printer className="h-4 w-4 mr-2" />
            {t("outstanding.combined.print")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
