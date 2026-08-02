"use client"

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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    margin: 0;
    padding: 16mm 14mm;
    font-size: 12px;
    background: #fff;
  }
  .sheet { max-width: 900px; margin: 0 auto; }
  .brand { text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
  .brand img { max-width: 72px; max-height: 48px; object-fit: contain; filter: grayscale(100%) contrast(180%); }
  .brand h1 { font-size: 18px; margin: 8px 0 4px; }
  .brand .sub { font-size: 11px; color: #333; line-height: 1.45; }
  .doc-title {
    text-align: center;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin: 0 0 14px;
  }
  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
    margin-bottom: 18px;
    padding: 10px 12px;
    border: 1px solid #ccc;
    background: #fafafa;
  }
  .meta div { line-height: 1.4; }
  .meta strong { display: inline-block; min-width: 88px; }
  .invoice-block {
    margin-bottom: 18px;
    page-break-inside: avoid;
    border: 1px solid #bbb;
  }
  .invoice-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 10px;
    background: #f0f0f0;
    border-bottom: 1px solid #bbb;
    font-weight: 700;
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-top: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f7f7f7; font-size: 11px; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .invoice-foot {
    display: flex;
    justify-content: flex-end;
    gap: 18px;
    flex-wrap: wrap;
    padding: 8px 10px;
    border-top: 1px solid #bbb;
    background: #fcfcfc;
    font-size: 11px;
  }
  .grand {
    margin-top: 8px;
    border: 2px solid #111;
    padding: 12px 14px;
  }
  .grand-row {
    display: flex;
    justify-content: space-between;
    max-width: 360px;
    margin-left: auto;
    padding: 3px 0;
  }
  .grand-row.total { font-size: 14px; font-weight: 700; margin-top: 4px; }
  .hint { margin-top: 14px; font-size: 10px; color: #555; text-align: center; }
  .empty { text-align: center; color: #666; padding: 16px; }
  @media print {
    body { padding: 8mm; }
    .invoice-block { break-inside: avoid; }
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
  noItems: string
  invoices: Invoice[]
  warehouses: Warehouse[]
  formatAmount: (amount: number, invoice: Invoice) => string
  logoUrl: string
}): string {
  const first = args.invoices[0]
  const sections = args.invoices
    .map((invoice) => {
      const invoiceId = escapeHtml(invoice.composite_id || String(invoice.id))
      const date = invoice.created_at
        ? escapeHtml(format(new Date(invoice.created_at), "PPP"))
        : "—"
      const items = invoice.items || []
      const rows =
        items.length === 0
          ? `<tr><td colspan="7" class="empty">${escapeHtml(args.noItems)}</td></tr>`
          : items
              .map(
                (item) => `
          <tr>
            <td>${escapeHtml(item.product_name || "—")}</td>
            <td class="num">${toNum(item.quantity)}</td>
            <td class="num">${escapeHtml(args.formatAmount(toNum(item.unit_price), invoice))}</td>
            <td class="num">${toNum(item.discount_percent)}%</td>
            <td class="num">${escapeHtml(args.formatAmount(toNum(item.total_price), invoice))}</td>
            <td class="num">${escapeHtml(args.formatAmount(toNum(item.paid_amount), invoice))}</td>
            <td class="num">${escapeHtml(args.formatAmount(itemRemaining(item), invoice))}</td>
          </tr>`,
              )
              .join("")

      return `
        <section class="invoice-block">
          <div class="invoice-head">
            <span>${escapeHtml(args.invoiceLabel)} #${invoiceId}</span>
            <span>${date}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(args.productLabel)}</th>
                <th class="num">${escapeHtml(args.qtyLabel)}</th>
                <th class="num">${escapeHtml(args.unitLabel)}</th>
                <th class="num">${escapeHtml(args.discountLabel)}</th>
                <th class="num">${escapeHtml(args.totalLabel)}</th>
                <th class="num">${escapeHtml(args.paidLabel)}</th>
                <th class="num">${escapeHtml(args.outstandingLabel)}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="invoice-foot">
            <span>${escapeHtml(args.totalLabel)}: <strong>${escapeHtml(args.formatAmount(toNum(invoice.total_amount), invoice))}</strong></span>
            <span>${escapeHtml(args.paidLabel)}: <strong>${escapeHtml(args.formatAmount(toNum(invoice.total_paid), invoice))}</strong></span>
            <span>${escapeHtml(args.outstandingLabel)}: <strong>${escapeHtml(args.formatAmount(toNum(invoice.remaining_amount), invoice))}</strong></span>
          </div>
        </section>`
    })
    .join("")

  const grandTotal = args.invoices.reduce((s, inv) => s + toNum(inv.total_amount), 0)
  const grandPaid = args.invoices.reduce((s, inv) => s + toNum(inv.total_paid), 0)
  const grandOutstanding = args.invoices.reduce((s, inv) => s + toNum(inv.remaining_amount), 0)
  const fmt = (n: number) => (first ? args.formatAmount(n, first) : n.toFixed(3))

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(args.title)}</title><style>${PRINT_STYLES}</style></head><body>
    <div class="sheet">
      <div class="brand">
        <img src="${escapeHtml(args.logoUrl)}" alt="DarArab" onerror="this.style.display='none'" />
        <h1>DarArab for Publishing &amp; Translation</h1>
        <div class="sub">
          Seeb, Muscat, Sultanate of Oman<br/>
          Tel: +96871523542 · Email: info@dararab.co.uk · Web: dararab.co.uk
        </div>
      </div>
      <div class="doc-title">${escapeHtml(args.title)}</div>
      <div class="meta">
        <div><strong>${escapeHtml(args.customerLabel)}:</strong> ${escapeHtml(args.customerName)}</div>
        <div><strong>${escapeHtml(args.warehouseLabel)}:</strong> ${escapeHtml(args.warehouseName)}</div>
        <div><strong>${escapeHtml(args.contactLabel)}:</strong> ${escapeHtml(args.contactName)}</div>
        <div><strong>${escapeHtml(args.invoicesLabel)}:</strong> ${args.invoices.length}</div>
      </div>
      ${sections}
      <div class="grand">
        <div class="grand-row"><span>${escapeHtml(args.grandTotalLabel)}</span><span>${escapeHtml(fmt(grandTotal))}</span></div>
        <div class="grand-row"><span>${escapeHtml(args.grandPaidLabel)}</span><span>${escapeHtml(fmt(grandPaid))}</span></div>
        <div class="grand-row total"><span>${escapeHtml(args.grandOutstandingLabel)}</span><span>${escapeHtml(fmt(grandOutstanding))}</span></div>
      </div>
      <p class="hint">${escapeHtml(args.viewOnlyHint)}</p>
    </div>
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

  const first = invoices[0]
  const grandTotal = invoices.reduce((s, inv) => s + toNum(inv.total_amount), 0)
  const grandPaid = invoices.reduce((s, inv) => s + toNum(inv.total_paid), 0)
  const grandOutstanding = invoices.reduce((s, inv) => s + toNum(inv.remaining_amount), 0)

  const formatAmount = (amount: number, invoice: Invoice) =>
    formatInvoiceUsdAmount(amount, invoice, warehouses)

  const handlePrint = () => {
    if (!invoices.length) return
    const logoUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/dararab-logo-1.png`
        : "/dararab-logo-1.png"

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
      noItems: t("outstanding.dialog.noItems"),
      invoices,
      warehouses,
      formatAmount,
      logoUrl,
    })

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=960,height=1100")
    if (!printWindow) {
      return
    }
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    const trigger = () => {
      printWindow.focus()
      printWindow.print()
    }
    if (printWindow.document.readyState === "complete") {
      setTimeout(trigger, 250)
    } else {
      printWindow.onload = () => setTimeout(trigger, 250)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full max-w-5xl flex-col gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 space-y-1 pb-2">
          <DialogTitle>{t("outstanding.combined.title")}</DialogTitle>
          <DialogDescription>{t("outstanding.combined.description")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 p-3">
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
            <div className="mx-auto max-w-4xl rounded-md border bg-white p-6 text-sm shadow-sm text-black">
              <div className="mb-5 border-b-2 border-black pb-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/dararab-logo-1.png"
                  alt="DarArab"
                  className="mx-auto mb-2 h-10 w-auto object-contain grayscale contrast-200"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = "none"
                  }}
                />
                <h2 className="text-base font-bold">DarArab for Publishing & Translation</h2>
                <p className="mt-1 text-xs text-neutral-600">
                  Seeb, Muscat, Sultanate of Oman
                  <br />
                  Tel: +96871523542 · Email: info@dararab.co.uk
                </p>
              </div>

              <h3 className="mb-4 text-center text-sm font-bold uppercase tracking-wide">
                {t("outstanding.combined.title")}
              </h3>

              <div className="mb-5 grid gap-2 rounded border bg-neutral-50 p-3 text-sm sm:grid-cols-2">
                <p>
                  <span className="font-semibold">{t("outstanding.table.customer")}: </span>
                  {first?.customer_name || t("outstanding.table.noCustomer")}
                </p>
                <p>
                  <span className="font-semibold">{t("outstanding.table.warehouse")}: </span>
                  {first?.warehouse_name || t("outstanding.table.noWarehouse")}
                </p>
                <p>
                  <span className="font-semibold">{t("outstanding.combined.contact")}: </span>
                  {first?.customer_contact || t("common.na")}
                </p>
                <p>
                  <span className="font-semibold">{t("outstanding.combined.invoiceCount")}: </span>
                  {invoices.length}
                </p>
              </div>

              <div className="space-y-4">
                {invoices.map((invoice) => {
                  const invoiceId = invoice.composite_id || String(invoice.id)
                  const items = invoice.items || []
                  return (
                    <section key={invoice.id} className="overflow-hidden rounded border border-neutral-300">
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-100 px-3 py-2 font-semibold">
                        <span>
                          {t("outstanding.combined.invoice")} #{invoiceId}
                        </span>
                        <span className="text-xs font-normal text-neutral-600">
                          {invoice.created_at
                            ? format(new Date(invoice.created_at), "PPP")
                            : t("outstanding.table.noDate")}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-neutral-50 text-left">
                              <th className="px-3 py-2 font-medium">{t("outstanding.combined.product")}</th>
                              <th className="px-3 py-2 text-right font-medium">{t("outstanding.combined.qty")}</th>
                              <th className="px-3 py-2 text-right font-medium">
                                {t("outstanding.combined.unitPrice")}
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                {t("outstanding.combined.discount")}
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                {t("outstanding.table.totalAmount")}
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                {t("outstanding.table.paidAmount")}
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                {t("outstanding.table.outstanding")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-3 py-6 text-center text-neutral-500">
                                  {t("outstanding.dialog.noItems")}
                                </td>
                              </tr>
                            ) : (
                              items.map((item, idx) => (
                                <tr key={item.id ?? `${invoice.id}-${idx}`} className="border-b last:border-0">
                                  <td className="px-3 py-2">{item.product_name || t("common.na")}</td>
                                  <td className="px-3 py-2 text-right">{toNum(item.quantity)}</td>
                                  <td className="px-3 py-2 text-right">
                                    {formatAmount(toNum(item.unit_price), invoice)}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {toNum(item.discount_percent)}%
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {formatAmount(toNum(item.total_price), invoice)}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {formatAmount(toNum(item.paid_amount), invoice)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium text-red-700">
                                    {formatAmount(itemRemaining(item), invoice)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-wrap justify-end gap-4 border-t bg-neutral-50 px-3 py-2 text-xs">
                        <span>
                          {t("outstanding.table.totalAmount")}:{" "}
                          <strong>{formatAmount(toNum(invoice.total_amount), invoice)}</strong>
                        </span>
                        <span>
                          {t("outstanding.table.paidAmount")}:{" "}
                          <strong>{formatAmount(toNum(invoice.total_paid), invoice)}</strong>
                        </span>
                        <span className="text-red-700">
                          {t("outstanding.table.outstanding")}:{" "}
                          <strong>{formatAmount(toNum(invoice.remaining_amount), invoice)}</strong>
                        </span>
                      </div>
                    </section>
                  )
                })}
              </div>

              <div className="mt-5 border-2 border-black p-4">
                <div className="ml-auto max-w-sm space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>{t("outstanding.combined.grandTotal")}</span>
                    <strong>{first ? formatAmount(grandTotal, first) : grandTotal.toFixed(3)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("outstanding.combined.grandPaid")}</span>
                    <strong>{first ? formatAmount(grandPaid, first) : grandPaid.toFixed(3)}</strong>
                  </div>
                  <div className="flex justify-between text-base font-bold text-red-700">
                    <span>{t("outstanding.combined.grandOutstanding")}</span>
                    <span>
                      {first ? formatAmount(grandOutstanding, first) : grandOutstanding.toFixed(3)}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-neutral-500">
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
            <Printer className="mr-2 h-4 w-4" />
            {t("outstanding.combined.print")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
