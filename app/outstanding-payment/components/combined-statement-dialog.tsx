"use client"

import { useRef, useState } from "react"
import { format } from "date-fns"
import { Download, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, Printer } from "lucide-react"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

function itemStatus(item: InvoiceItem): "Paid" | "Partial" | "Due" {
  const total = toNum(item.total_price)
  const paid = toNum(item.paid_amount)
  if (item.is_paid || paid >= total - 0.001) return "Paid"
  if (paid > 0.001) return "Partial"
  return "Due"
}

const STATUS_LABEL: Record<"Paid" | "Partial" | "Due", { en: string; ar: string; color: string }> = {
  Paid: { en: "Paid", ar: "مدفوع", color: "#15803d" },
  Partial: { en: "Partial", ar: "مدفوع جزئياً", color: "#c2410c" },
  Due: { en: "Unpaid", ar: "غير مدفوع", color: "#b91c1c" },
}

const PAPER_STYLES = `
  .combined-paper {
    color: #000000;
    background: #ffffff;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 9px;
    line-height: 1.35;
    width: 340px;
    max-width: 340px;
    padding: 8px 10px 10px;
    box-sizing: border-box;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  .combined-paper .section-title {
    font-weight: bold;
    font-size: 9px;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    border-bottom: 1px solid #000;
    padding-bottom: 3px;
    margin-bottom: 5px;
  }
  .combined-paper .item-block {
    border: 1px solid #000;
    border-radius: 2px;
    padding: 6px;
    margin-bottom: 6px;
  }
  .combined-paper .item-name {
    font-weight: 700;
    font-size: 9px;
    margin-bottom: 4px;
  }
  .combined-paper .item-row {
    display: flex;
    justify-content: space-between;
    font-size: 8px;
    margin-top: 2px;
    gap: 6px;
  }
  .combined-paper .kv-label {
    font-weight: 700;
    font-size: 8px;
    margin-bottom: 1px;
  }
  .combined-paper .kv-value {
    font-size: 9px;
    margin-bottom: 5px;
  }
`

async function waitForImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        }),
    ),
  )
}

async function capturePaperToCanvas(paperEl: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas")).default
  const wrapper = document.createElement("div")
  wrapper.setAttribute("aria-hidden", "true")
  wrapper.style.position = "fixed"
  wrapper.style.left = "-10000px"
  wrapper.style.top = "0"
  wrapper.style.width = `${paperEl.offsetWidth || 340}px`
  wrapper.style.overflow = "visible"
  wrapper.style.background = "#ffffff"
  wrapper.style.zIndex = "-1"
  wrapper.style.pointerEvents = "none"

  const clone = paperEl.cloneNode(true) as HTMLElement
  clone.style.overflow = "visible"
  clone.style.maxHeight = "none"
  clone.style.height = "auto"
  clone.style.transform = "none"
  clone.style.maxWidth = "340px"
  clone.style.width = "100%"
  clone.style.position = "static"
  clone.style.left = "auto"
  clone.style.visibility = "visible"

  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)

  try {
    await waitForImages(clone)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const width = Math.ceil(clone.scrollWidth || clone.offsetWidth || 340)
    const height = Math.ceil(clone.scrollHeight || clone.offsetHeight)
    return await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      allowTaint: true,
      logging: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
    })
  } finally {
    document.body.removeChild(wrapper)
  }
}

function openPaperPrintWindow(paperEl: HTMLElement): void {
  const printWindow = window.open("", "_blank", "width=480,height=900")
  if (!printWindow) return

  printWindow.document.open()
  printWindow.document.write("<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Statement</title>")
  printWindow.document.write(`<style>
    @page { size: auto; margin: 8mm; }
    html, body {
      margin: 0; padding: 0; width: 100%; height: auto; overflow: visible !important;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 11px; line-height: 1.35; color: #000;
      display: flex; justify-content: center; padding: 10px; box-sizing: border-box;
    }
    ${PAPER_STYLES}
  </style>`)
  printWindow.document.write("</head><body>")
  printWindow.document.write(paperEl.outerHTML)
  printWindow.document.write("</body></html>")
  printWindow.document.close()

  const trigger = () => {
    printWindow.focus()
    printWindow.print()
  }
  setTimeout(() => {
    void waitForImages(printWindow.document).then(trigger)
  }, 250)
}

export function CombinedStatementDialog({
  open,
  onOpenChange,
  invoices,
  warehouses,
  isLoading,
}: CombinedStatementDialogProps) {
  const { t } = useLanguage()
  const paperRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState<"image" | "pdf" | "xlsx" | null>(null)

  const first = invoices[0]
  const grandTotal = invoices.reduce((s, inv) => s + toNum(inv.total_amount), 0)
  const grandPaid = invoices.reduce((s, inv) => s + toNum(inv.total_paid), 0)
  const grandOutstanding = invoices.reduce((s, inv) => s + toNum(inv.remaining_amount), 0)

  const formatAmount = (amount: number, invoice: Invoice) =>
    formatInvoiceUsdAmount(amount, invoice, warehouses)

  const money = (amount: number, invoice: Invoice = first!) =>
    first ? formatAmount(amount, invoice) : amount.toFixed(3)

  const handlePrint = () => {
    if (!paperRef.current || !invoices.length) return
    openPaperPrintWindow(paperRef.current)
  }

  const handleDownloadImage = async () => {
    if (!paperRef.current || !invoices.length) return
    setExporting("image")
    try {
      const canvas = await capturePaperToCanvas(paperRef.current)
      const link = document.createElement("a")
      link.download = `outstanding-statement-${format(new Date(), "yyyyMMdd-HHmm")}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch (error) {
      console.error("Error generating image:", error)
    } finally {
      setExporting(null)
    }
  }

  const handleDownloadPdf = async () => {
    if (!paperRef.current || !invoices.length) return
    setExporting("pdf")
    try {
      const canvas = await capturePaperToCanvas(paperRef.current)
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const doc = new jsPDF({
        unit: "px",
        format: [imgWidth, imgHeight],
        orientation: imgHeight > imgWidth ? "portrait" : "landscape",
      })
      doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgWidth, imgHeight)
      doc.save(`outstanding-statement-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
    } finally {
      setExporting(null)
    }
  }

  const handleDownloadExcel = () => {
    if (!invoices.length) return
    setExporting("xlsx")
    try {
      const rows: Array<Record<string, string | number>> = []
      for (const invoice of invoices) {
        const invoiceId = invoice.composite_id || String(invoice.id)
        const date = invoice.created_at ? format(new Date(invoice.created_at), "yyyy-MM-dd") : ""
        const items = invoice.items || []
        if (items.length === 0) {
          rows.push({
            Invoice: invoiceId,
            Date: date,
            Customer: invoice.customer_name || "",
            Warehouse: invoice.warehouse_name || "",
            Product: "",
            Qty: "",
            "Unit price": "",
            "Discount %": "",
            Total: toNum(invoice.total_amount),
            Paid: toNum(invoice.total_paid),
            Outstanding: toNum(invoice.remaining_amount),
          })
          continue
        }
        for (const item of items) {
          rows.push({
            Invoice: invoiceId,
            Date: date,
            Customer: invoice.customer_name || "",
            Warehouse: invoice.warehouse_name || "",
            Product: item.product_name || "",
            Qty: toNum(item.quantity),
            "Unit price": toNum(item.unit_price),
            "Discount %": toNum(item.discount_percent),
            Total: toNum(item.total_price),
            Paid: toNum(item.paid_amount),
            Outstanding: itemRemaining(item),
          })
        }
      }
      rows.push({
        Invoice: "",
        Date: "",
        Customer: "",
        Warehouse: "",
        Product: "GRAND TOTAL",
        Qty: "",
        "Unit price": "",
        "Discount %": "",
        Total: grandTotal,
        Paid: grandPaid,
        Outstanding: grandOutstanding,
      })

      const sheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, "Outstanding")
      XLSX.writeFile(
        workbook,
        `outstanding-statement-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`,
      )
    } finally {
      setExporting(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full max-w-4xl flex-col gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 space-y-1 pb-2">
          <DialogTitle>{t("outstanding.combined.title")}</DialogTitle>
          <DialogDescription>{t("outstanding.combined.reviewDescription")}</DialogDescription>
        </DialogHeader>

        {/* Formal paper — off-screen, used for print / image / PDF (matches regular receipt) */}
        {!isLoading && invoices.length > 0 ? (
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              left: "-10000px",
              top: 0,
              pointerEvents: "none",
              zIndex: -1,
            }}
          >
            <style dangerouslySetInnerHTML={{ __html: PAPER_STYLES }} />
            <div ref={paperRef} className="combined-paper">
              <div
                style={{
                  textAlign: "center",
                  borderBottom: "1px dashed #000",
                  paddingBottom: 6,
                  marginBottom: 6,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/dararab-logo-1.png"
                  alt="DarArab Logo"
                  style={{
                    maxWidth: 56,
                    maxHeight: 38,
                    objectFit: "contain",
                    filter: "grayscale(100%) contrast(200%)",
                    display: "block",
                    margin: "0 auto 4px",
                  }}
                />
                <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 4, lineHeight: 1.25 }}>
                  DarArab for Publishing & Translation
                </div>
                <div style={{ fontSize: 8, margin: "2px 0" }}>Seeb, Muscat, Sultanate of Oman</div>
                <div style={{ fontSize: 8, margin: "2px 0" }}>Tel: +96871523542</div>
                <div style={{ fontSize: 8, margin: "2px 0" }}>Email: info@dararab.co.uk</div>
                <div style={{ fontSize: 8, margin: "2px 0" }}>Web: dararab.co.uk</div>
              </div>

              <div
                style={{
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                {t("outstanding.combined.title")}
              </div>

              <div
                style={{
                  marginBottom: 8,
                  paddingBottom: 5,
                  borderBottom: "1px dashed #000",
                  fontSize: 8,
                  lineHeight: 1.25,
                }}
              >
                <div style={{ marginBottom: 2 }}>
                  <strong>Cust:</strong> {first?.customer_name || "—"}
                  {first?.customer_contact ? (
                    <>
                      <span style={{ margin: "0 4px" }}>·</span>
                      {first.customer_contact}
                    </>
                  ) : null}
                </div>
                <div style={{ marginBottom: 2 }}>
                  <strong>Wh:</strong> {first?.warehouse_name || "—"}
                  <span style={{ margin: "0 4px" }}>·</span>
                  <strong>Invoices:</strong> {invoices.length}
                  <span style={{ margin: "0 4px" }}>·</span>
                  {format(new Date(), "PPP")}
                </div>
              </div>

              {invoices.map((invoice) => {
                const invoiceId = invoice.composite_id || String(invoice.id)
                const items = invoice.items || []
                return (
                  <div key={invoice.id} style={{ marginBottom: 12 }}>
                    <div className="section-title">
                      Invoice #{invoiceId}
                      <span style={{ margin: "0 4px", fontWeight: 400 }}>·</span>
                      <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                        {invoice.created_at
                          ? format(new Date(invoice.created_at), "PPP")
                          : "—"}
                      </span>
                    </div>

                    {items.length === 0 ? (
                      <div style={{ fontSize: 8, marginBottom: 6 }}>{t("outstanding.dialog.noItems")}</div>
                    ) : (
                      items.map((item, idx) => {
                        const status = itemStatus(item)
                        const labels = STATUS_LABEL[status]
                        const gross = toNum(item.unit_price) * toNum(item.quantity)
                        const discount = toNum(item.discount_percent)
                        return (
                          <div key={item.id ?? idx} className="item-block">
                            <div className="item-name">{item.product_name || "—"}</div>
                            <div className="item-row">
                              <span>Quantity</span>
                              <span>{toNum(item.quantity)}</span>
                            </div>
                            <div className="item-row">
                              <span>Unit price</span>
                              <span>{money(toNum(item.unit_price), invoice)}</span>
                            </div>
                            <div className="item-row">
                              <span>Line amount</span>
                              <span>{money(gross, invoice)}</span>
                            </div>
                            {discount > 0.001 ? (
                              <div className="item-row">
                                <span>Discount</span>
                                <span>{discount.toFixed(1)}%</span>
                              </div>
                            ) : null}
                            <div className="item-row" style={{ fontWeight: 600 }}>
                              <span>Line total</span>
                              <span>{money(toNum(item.total_price), invoice)}</span>
                            </div>
                            <div className="item-row" style={{ marginTop: 4 }}>
                              <span>Status / الحالة</span>
                              <span style={{ fontWeight: 700, color: labels.color }}>
                                {labels.ar} — {labels.en}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}

                    <div style={{ marginBottom: 4 }}>
                      <div className="kv-label">Invoice total</div>
                      <div className="kv-value" style={{ fontWeight: 700 }}>
                        {money(toNum(invoice.total_amount), invoice)}
                      </div>
                      <div className="kv-label">Total paid</div>
                      <div className="kv-value" style={{ fontWeight: 600, color: "#15803d" }}>
                        {money(toNum(invoice.total_paid), invoice)}
                      </div>
                      <div className="kv-label">Amount due</div>
                      <div
                        className="kv-value"
                        style={{
                          fontWeight: 700,
                          color: toNum(invoice.remaining_amount) > 0.001 ? "#b91c1c" : "#15803d",
                        }}
                      >
                        {money(toNum(invoice.remaining_amount), invoice)}
                      </div>
                    </div>
                  </div>
                )
              })}

              <div>
                <div className="section-title">Grand totals</div>
                <div className="kv-label">Grand total</div>
                <div className="kv-value">{money(grandTotal)}</div>
                <div className="kv-label">Grand paid</div>
                <div className="kv-value" style={{ fontWeight: 600, color: "#15803d" }}>
                  {money(grandPaid)}
                </div>
                <div
                  className="kv-label"
                  style={{ borderTop: "1px solid #000", paddingTop: 5, marginTop: 4 }}
                >
                  Grand outstanding
                </div>
                <div
                  className="kv-value"
                  style={{
                    fontWeight: 700,
                    fontSize: 10,
                    color: grandOutstanding > 0.001 ? "#b91c1c" : "#15803d",
                  }}
                >
                  {money(grandOutstanding)}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Simple review UI — no company branding */}
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
            <div className="space-y-4 p-1">
              <div className="grid gap-1 rounded-md border bg-muted/40 p-3 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">{t("outstanding.table.customer")}: </span>
                  {first?.customer_name || t("outstanding.table.noCustomer")}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("outstanding.table.warehouse")}: </span>
                  {first?.warehouse_name || t("outstanding.table.noWarehouse")}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("outstanding.combined.contact")}: </span>
                  {first?.customer_contact || t("common.na")}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("outstanding.combined.invoiceCount")}: </span>
                  {invoices.length}
                </p>
              </div>

              {invoices.map((invoice) => {
                const invoiceId = invoice.composite_id || String(invoice.id)
                const items = invoice.items || []
                return (
                  <div key={invoice.id} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-medium">
                        {t("outstanding.combined.invoice")} #{invoiceId}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {invoice.created_at
                          ? format(new Date(invoice.created_at), "PPP")
                          : t("outstanding.table.noDate")}
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("outstanding.combined.product")}</TableHead>
                            <TableHead className="text-right">{t("outstanding.combined.qty")}</TableHead>
                            <TableHead className="text-right">
                              {t("outstanding.combined.unitPrice")}
                            </TableHead>
                            <TableHead className="text-right">
                              {t("outstanding.combined.discount")}
                            </TableHead>
                            <TableHead className="text-right">
                              {t("outstanding.table.totalAmount")}
                            </TableHead>
                            <TableHead className="text-right">
                              {t("outstanding.table.outstanding")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground">
                                {t("outstanding.dialog.noItems")}
                              </TableCell>
                            </TableRow>
                          ) : (
                            items.map((item, idx) => (
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
                                <TableCell className="text-right text-red-600">
                                  {formatAmount(itemRemaining(item), invoice)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex flex-wrap justify-end gap-4 text-xs text-muted-foreground">
                      <span>
                        {t("outstanding.table.totalAmount")}:{" "}
                        <strong className="text-foreground">
                          {formatAmount(toNum(invoice.total_amount), invoice)}
                        </strong>
                      </span>
                      <span>
                        {t("outstanding.table.outstanding")}:{" "}
                        <strong className="text-red-600">
                          {formatAmount(toNum(invoice.remaining_amount), invoice)}
                        </strong>
                      </span>
                    </div>
                  </div>
                )
              })}

              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="ml-auto max-w-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("outstanding.combined.grandTotal")}</span>
                    <strong>{money(grandTotal)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("outstanding.combined.grandPaid")}</span>
                    <strong>{money(grandPaid)}</strong>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>{t("outstanding.combined.grandOutstanding")}</span>
                    <strong>{money(grandOutstanding)}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t pt-3 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={isLoading || invoices.length === 0 || !!exporting}
            >
              <Printer className="mr-2 h-4 w-4" />
              {t("outstanding.combined.print")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isLoading || invoices.length === 0 || !!exporting}>
                  {exporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {t("outstanding.combined.download")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadImage}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  {t("outstanding.combined.saveImage")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadPdf}>
                  <FileText className="mr-2 h-4 w-4" />
                  {t("outstanding.combined.savePdf")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadExcel}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {t("outstanding.combined.saveExcel")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
