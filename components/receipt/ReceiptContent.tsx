"use client"

import { useRef } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Printer, Download, FileText, Image } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import jsPDF from "jspdf"

/** Coerce API / JSON values to a finite number (avoids `.toFixed` on strings). */
export function toNum(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const n = parseFloat(String(value ?? "").replace(/,/g, ""))
  return Number.isFinite(n) ? n : fallback
}

export interface ReceiptItem {
  id?: number
  product_name?: string
  product?: {
    id: number
    title_en: string
    title_ar?: string
    price?: string | null
    price_omr?: string | null
    latest_price?: string | null
    latest_price_omr?: string | null
  }
  quantity: number
  unit_price: number
  discount_percent?: number
  total_price: number
  paid_amount?: number
  is_paid?: boolean
}

export interface ReceiptData {
  id: number
  composite_id?: string
  customer_name: string
  customer_contact?: string
  warehouse_name: string
  warehouse_location?: string
  invoice_type_name?: string
  payment_method_name?: string
  items: ReceiptItem[]
  total_amount: number
  total_paid?: number
  remaining_amount?: number
  notes?: string
  created_at_formatted?: string
  global_discount_percent?: number
  tax_percent?: number
  // For POS cart-based receipts
  subtotal?: number
  globalDiscountAmount?: number
  tax?: number
  total?: number
  totalUnpaidAmount?: number
  hasPartialPayment?: boolean
}

interface ReceiptContentProps {
  receiptData: ReceiptData
  currencyLabel: string
  getDisplayPrice: (item: ReceiptItem) => string | null
  onClose?: () => void
}

export function ReceiptContent({ receiptData, currencyLabel, getDisplayPrice, onClose }: ReceiptContentProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const getItemLineGross = (item: ReceiptItem) => toNum(item.unit_price) * toNum(item.quantity)

  /** Prefer API/POS `total_price` (final after all discounts); else derive from unit × qty × line %. */
  const getItemLineTotal = (item: ReceiptItem) => {
    if (item.total_price !== undefined && item.total_price !== null) {
      const fromApi = toNum(item.total_price)
      if (Number.isFinite(fromApi)) return Math.max(0, fromApi)
    }
    const price = toNum(item.unit_price)
    const quantity = toNum(item.quantity)
    const discount = toNum(item.discount_percent) / 100
    const raw = price * quantity * (1 - discount)
    return Number.isFinite(raw) ? Math.max(0, raw) : 0
  }

  const getItemEffectiveDiscountPercent = (item: ReceiptItem) => {
    const gross = getItemLineGross(item)
    if (gross <= 1e-9) return 0
    const net = getItemLineTotal(item)
    return Math.max(0, Math.min(100, Number((100 * (1 - net / gross)).toFixed(3))))
  }

  // Calculate financial summary
  const calculateFinancials = () => {
    // If using POS cart data (has subtotal, tax, etc.)
    if (receiptData.subtotal !== undefined) {
      return {
        subtotal: toNum(receiptData.subtotal),
        globalDiscountAmount: toNum(receiptData.globalDiscountAmount),
        tax: toNum(receiptData.tax),
        total: toNum(receiptData.total ?? receiptData.total_amount),
        totalPaid: toNum(receiptData.total_paid),
        totalUnpaid: toNum(receiptData.totalUnpaidAmount),
      }
    }

    // Invoice / summary API: global may be 0 when discount is already on each line (POS store/individual)
    const items = receiptData.items || []
    const lineGrossSum = items.reduce((sum, item) => sum + getItemLineGross(item), 0)
    const lineNetSum = items.reduce((sum, item) => sum + getItemLineTotal(item), 0)
    const apiGlobalPct = toNum(receiptData.global_discount_percent)
    const discountFromLines = Math.max(0, lineGrossSum - lineNetSum)

    if (apiGlobalPct < 0.001 || discountFromLines > 0.001) {
      const subtotal = lineGrossSum
      const globalDiscountAmount = discountFromLines
      const discountedSubtotal = lineNetSum
      const taxPercentRaw = toNum(receiptData.tax_percent)
      const tax = discountedSubtotal * (taxPercentRaw / 100)
      const total = discountedSubtotal + tax
      const totalPaid = toNum(receiptData.total_paid)
      const totalUnpaid = Math.max(0, total - totalPaid)
      return {
        subtotal,
        globalDiscountAmount,
        tax,
        total,
        totalPaid,
        totalUnpaid,
      }
    }

    // Legacy: invoice-level global only (lines do not include global in their totals)
    const subtotal = items.reduce((sum, item) => sum + getItemLineTotal(item), 0)
    const globalDiscountAmount = (subtotal * apiGlobalPct) / 100
    const discountedSubtotal = subtotal - globalDiscountAmount
    const taxPercentRaw = toNum(receiptData.tax_percent)
    const tax = discountedSubtotal * (taxPercentRaw / 100)
    const total = discountedSubtotal + tax
    const totalPaid = toNum(receiptData.total_paid)
    const totalUnpaid = Math.max(0, total - totalPaid)

    return {
      subtotal,
      globalDiscountAmount,
      tax,
      total,
      totalPaid,
      totalUnpaid,
    }
  }

  const financials = calculateFinancials()
  const rawGlobalPct = receiptData.global_discount_percent
  const globalDiscountPercent =
    rawGlobalPct !== undefined && rawGlobalPct !== null && String(rawGlobalPct).trim() !== ""
      ? toNum(rawGlobalPct)
      : financials.subtotal > 0
        ? (financials.globalDiscountAmount / financials.subtotal) * 100
        : 0
  const rawTaxPct = receiptData.tax_percent
  const taxPercent =
    rawTaxPct !== undefined && rawTaxPct !== null && String(rawTaxPct).trim() !== ""
      ? toNum(rawTaxPct)
      : financials.subtotal > 0
        ? (financials.tax / financials.subtotal) * 100
        : 0

  const displayGlobalDiscountPercent =
    globalDiscountPercent > 0.001
      ? globalDiscountPercent
      : financials.subtotal > 0
        ? (financials.globalDiscountAmount / financials.subtotal) * 100
        : 0

  // Determine payment status for items
  const isFullyPaid = Math.abs(toNum(financials.totalPaid) - toNum(financials.total)) < 0.001

  const handlePrint = () => {
    if (printRef.current) {
      try {
        const printWindow = window.open("", "_blank")
        if (printWindow) {
          printWindow.document.write("<html><head><title>Receipt</title>")
          printWindow.document.write(`
            <style>
              @media print {
                @page { 
                  size: auto; 
                  margin: 0; 
                }
                body { 
                  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; 
                  font-size: 11px; 
                  line-height: 1.35; 
                  margin: 0; 
                  padding: 10px; 
                  width: 100%;
                  color: #000000;
                }
                .receipt-container { 
                  width: 100% !important; 
                  max-width: 100% !important; 
                  margin: 0 !important; 
                  padding: 0 !important;
                  color: #000000 !important;
                }
                .receipt-section-title {
                  border-bottom: 1px solid #000 !important;
                  padding-bottom: 3px !important;
                  margin-bottom: 5px !important;
                  color: #000000 !important;
                }
                .receipt-meta-compact {
                  color: #000000 !important;
                }
                .receipt-kv-value, .receipt-item-name {
                  word-wrap: break-word !important;
                  overflow-wrap: anywhere !important;
                  white-space: normal !important;
                  color: #000000 !important;
                }
                img {
                  -webkit-print-color-adjust: exact !important;
                  color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
              body { 
                font-family: system-ui, -apple-system, "Segoe UI", sans-serif; 
                font-size: 11px; 
                line-height: 1.35; 
                margin: 0; 
                padding: 10px; 
                width: 100%;
                color: #000000;
              }
              .receipt-container { color: #000000; }
              .receipt-section-title {
                font-weight: bold;
                font-size: 9px;
                letter-spacing: 0.03em;
                text-transform: uppercase;
                border-bottom: 1px solid #000;
                padding-bottom: 3px;
                margin-bottom: 5px;
                color: #000000;
              }
              .receipt-meta-compact {
                font-size: 8px;
                line-height: 1.25;
                margin-bottom: 6px;
                padding-bottom: 5px;
                border-bottom: 1px dashed #000;
                color: #000000;
              }
              .receipt-meta-compact strong { font-weight: 700; }
              .receipt-kv-block { margin-bottom: 5px; }
              .receipt-kv-label { font-weight: 700; font-size: 8px; color: #000000; margin-bottom: 1px; }
              .receipt-kv-value {
                font-size: 9px;
                color: #000000;
                word-wrap: break-word;
                overflow-wrap: anywhere;
                white-space: normal;
              }
              .receipt-item-block {
                border: 1px solid #000;
                border-radius: 2px;
                padding: 6px;
                margin-bottom: 6px;
              }
              .receipt-item-name {
                font-weight: 700;
                font-size: 9px;
                margin-bottom: 4px;
                color: #000000;
                word-wrap: break-word;
                overflow-wrap: anywhere;
                white-space: normal;
              }
              .receipt-item-row { display: flex; justify-content: space-between; font-size: 8px; margin-top: 2px; gap: 6px; color: #000000; }
            </style>
          `)
          printWindow.document.write("</head><body>")
          printWindow.document.write(printRef.current.innerHTML)
          printWindow.document.write("</body></html>")
          printWindow.document.close()
          printWindow.print()
        }
      } catch (error) {
        console.error("Error printing:", error)
      }
    }
  }

  const handleDownloadPDF = () => {
    if (printRef.current) {
      import('html2canvas').then((html2canvas) => {
        setTimeout(() => {
          html2canvas.default(printRef.current!, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            allowTaint: true,
            logging: false,
            width: printRef.current?.scrollWidth,
            height: printRef.current?.scrollHeight
          }).then(canvas => {
            const imgWidth = canvas.width
            const imgHeight = canvas.height
            
            const doc = new jsPDF({
              unit: 'px',
              format: [imgWidth, imgHeight],
              orientation: imgHeight > imgWidth ? 'portrait' : 'landscape'
            })
            
            const imgData = canvas.toDataURL('image/png')
            doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
            doc.save('receipt.pdf')
          }).catch(error => {
            console.error('Error generating PDF:', error)
          })
        }, 500)
      })
    }
  }

  const handleDownloadImage = () => {
    if (printRef.current) {
      import('html2canvas').then((html2canvas) => {
        setTimeout(() => {
          html2canvas.default(printRef.current!, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            allowTaint: true,
            logging: false,
            width: printRef.current?.scrollWidth,
            height: printRef.current?.scrollHeight
          }).then(canvas => {
            const link = document.createElement('a')
            link.download = 'receipt.png'
            link.href = canvas.toDataURL()
            link.click()
          }).catch(error => {
            console.error('Error generating image:', error)
          })
        }, 500)
      })
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto my-4" ref={printRef}>
        <style
          dangerouslySetInnerHTML={{
            __html: `
        .receipt-container {
          color: #000000;
        }
        .receipt-section-title {
          font-weight: bold;
          font-size: 9px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          border-bottom: 1px solid #000;
          padding-bottom: 3px;
          margin-bottom: 5px;
          color: #000000;
        }
        .receipt-meta-compact {
          font-size: 8px;
          line-height: 1.25;
          margin-bottom: 6px;
          padding-bottom: 5px;
          border-bottom: 1px dashed #000;
          color: #000000;
        }
        .receipt-meta-compact strong { font-weight: 700; }
        .receipt-kv-block { margin-bottom: 5px; }
        .receipt-container .receipt-kv-label {
          font-weight: 700;
          font-size: 8px;
          color: #000000;
          margin-bottom: 1px;
        }
        .receipt-container .receipt-kv-value {
          font-size: 9px;
          color: #000000;
          word-wrap: break-word;
          overflow-wrap: anywhere;
          white-space: normal;
        }
        .receipt-container .receipt-item-block {
          border: 1px solid #000;
          border-radius: 2px;
          padding: 6px;
          margin-bottom: 6px;
        }
        .receipt-container .receipt-item-name {
          font-weight: 700;
          font-size: 9px;
          margin-bottom: 4px;
          color: #000000;
          word-wrap: break-word;
          overflow-wrap: anywhere;
          white-space: normal;
        }
        .receipt-container .receipt-item-row {
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          margin-top: 2px;
          gap: 6px;
          color: #000000;
        }
      `,
          }}
        />
        <div
          className="receipt-container"
          style={{
            width: "100%",
            maxWidth: "340px",
            margin: "0 auto",
            padding: "8px 10px 10px",
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: "9px",
            lineHeight: 1.35,
            backgroundColor: "white",
            minHeight: "100%",
            wordWrap: "break-word",
            overflowWrap: "anywhere",
            color: "#000000",
          }}
        >
          <div
            className="receipt-header text-center"
            style={{ borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}
          >
            <div style={{ marginBottom: "4px", display: "flex", justifyContent: "center", alignItems: "center" }}>
              <img
                src="/dararab-logo-1.png"
                alt="DarArab Logo"
                style={{
                  maxWidth: "56px",
                  maxHeight: "38px",
                  objectFit: "contain",
                  filter: "grayscale(100%) contrast(200%)",
                  display: "block",
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = "none"
                }}
              />
            </div>
            <h2 style={{ fontSize: "11px", fontWeight: "bold", margin: "0 0 4px 0", lineHeight: 1.25, color: "#000" }}>
              DarArab for Publishing & Translation
            </h2>
            <div
              style={{
                fontSize: "8px",
                margin: "2px 0",
                whiteSpace: "normal",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                color: "#000",
              }}
            >
              Seeb, Muscat, Sultanate of Oman
            </div>
            <div style={{ fontSize: "8px", margin: "2px 0", color: "#000" }}>Tel: +96871523542</div>
            <div
              style={{
                fontSize: "8px",
                margin: "2px 0",
                whiteSpace: "normal",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                color: "#000",
              }}
            >
              Email: info@dararab.co.uk
            </div>
            <div style={{ fontSize: "8px", margin: "2px 0", color: "#000" }}>Web: dararab.co.uk</div>
          </div>

          <div
            className="receipt-meta-compact"
            style={{
              marginBottom: "6px",
              paddingBottom: "5px",
              borderBottom: "1px dashed #000",
              fontSize: "8px",
              lineHeight: 1.25,
              color: "#000",
            }}
          >
            <div style={{ marginBottom: "2px", wordBreak: "break-word", overflowWrap: "anywhere" }}>
              <strong>#</strong>
              {receiptData.composite_id || String(receiptData.id)}
              <span style={{ margin: "0 4px" }}>·</span>
              {receiptData.created_at_formatted || format(new Date(), "PPP")}
            </div>
            <div style={{ marginBottom: "2px", wordBreak: "break-word", overflowWrap: "anywhere" }}>
              <strong>Cust:</strong> {receiptData.customer_name || "Walk-in"}
              {receiptData.customer_contact ? (
                <>
                  <span style={{ margin: "0 4px" }}>·</span>
                  {receiptData.customer_contact}
                </>
              ) : null}
            </div>
            <div style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
              <strong>Pay:</strong> {receiptData.payment_method_name || "—"}
              <span style={{ margin: "0 4px" }}>·</span>
              <strong>Type:</strong> {receiptData.invoice_type_name || "—"}
              <span style={{ margin: "0 4px" }}>·</span>
              <strong>Wh:</strong> {receiptData.warehouse_name || "—"}
              {receiptData.warehouse_location ? (
                <>
                  <span style={{ margin: "0 4px" }}>·</span>
                  {receiptData.warehouse_location}
                </>
              ) : null}
            </div>
          </div>

          <div style={{ marginBottom: "10px" }}>
            <div className="receipt-section-title">Items</div>
            {(receiptData.items || []).map((item, idx) => {
              const itemTotal = getItemLineTotal(item)
              const itemDiscountPercent = getItemEffectiveDiscountPercent(item)
              const lineGross = getItemLineGross(item)

              let status = "Due"

              if (isFullyPaid) {
                status = "Paid"
              } else if (item.is_paid || toNum(item.paid_amount) > 0) {
                const itemPaid = toNum(item.paid_amount)
                if (itemPaid >= itemTotal) {
                  status = "Paid"
                } else {
                  status = "Partial"
                }
              } else if (financials.totalPaid > 0) {
                status = "Partial"
              }

              const displayPrice = item.product ? getDisplayPrice(item) : null
              const displayPriceValue = displayPrice ? toNum(parseFloat(displayPrice)) : toNum(item.unit_price)
              const productLabel = item.product_name || item.product?.title_en || "Unknown Product"

              return (
                <div key={idx} className="receipt-item-block">
                  <div className="receipt-item-name">{productLabel}</div>
                  <div className="receipt-item-row">
                    <span>Quantity</span>
                    <span>{toNum(item.quantity)}</span>
                  </div>
                  <div className="receipt-item-row">
                    <span>Unit price</span>
                    <span>
                      {displayPriceValue.toFixed(3)} {currencyLabel}
                    </span>
                  </div>
                  <div className="receipt-item-row">
                    <span>Line amount</span>
                    <span>
                      {lineGross.toFixed(3)} {currencyLabel}
                    </span>
                  </div>
                  {itemDiscountPercent > 0.001 ? (
                    <div className="receipt-item-row">
                      <span>Discount</span>
                      <span>{itemDiscountPercent.toFixed(1)}%</span>
                    </div>
                  ) : null}
                  <div className="receipt-item-row" style={{ fontWeight: 600 }}>
                    <span>Line total</span>
                    <span>
                      {itemTotal.toFixed(3)} {currencyLabel}
                    </span>
                  </div>
                  <div className="receipt-item-row" style={{ marginTop: "4px" }}>
                    <span>Status</span>
                    <span style={{ fontWeight: 700, color: "#000" }}>
                      {status === "Partial" ? `${status} *` : status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginBottom: "10px" }}>
            <div className="receipt-section-title">Totals</div>
            <div className="receipt-kv-block">
              <div className="receipt-kv-label">Subtotal</div>
              <div className="receipt-kv-value">
                {financials.subtotal.toFixed(3)} {currencyLabel}
              </div>
            </div>
            {financials.globalDiscountAmount > 0.001 ? (
              <div className="receipt-kv-block">
                <div className="receipt-kv-label">
                  Discount ({displayGlobalDiscountPercent.toFixed(1)}%)
                </div>
                <div className="receipt-kv-value" style={{ fontWeight: 700 }}>
                  −{financials.globalDiscountAmount.toFixed(3)} {currencyLabel}
                </div>
              </div>
            ) : null}
            {taxPercent > 0 ? (
              <div className="receipt-kv-block">
                <div className="receipt-kv-label">Tax ({taxPercent.toFixed(1)}%)</div>
                <div className="receipt-kv-value">
                  {financials.tax.toFixed(3)} {currencyLabel}
                </div>
              </div>
            ) : null}
            <div className="receipt-kv-block" style={{ borderTop: "1px solid #000", paddingTop: "5px", marginTop: "4px" }}>
              <div className="receipt-kv-label">Invoice total</div>
              <div className="receipt-kv-value" style={{ fontWeight: 700, fontSize: "10px", color: "#000" }}>
                {financials.total.toFixed(3)} {currencyLabel}
              </div>
            </div>
            <div className="receipt-kv-block">
              <div className="receipt-kv-label">Total paid</div>
              <div className="receipt-kv-value" style={{ fontWeight: 600, color: "#000" }}>
                {financials.totalPaid.toFixed(3)} {currencyLabel}
              </div>
            </div>
            <div className="receipt-kv-block">
              <div className="receipt-kv-label">Amount due</div>
              <div className="receipt-kv-value" style={{ fontWeight: 700, color: "#000" }}>
                {financials.totalUnpaid.toFixed(3)} {currencyLabel}
                {financials.totalUnpaid > 0.001 ? " (balance)" : " (clear)"}
              </div>
            </div>
            {receiptData.hasPartialPayment ? (
              <div className="receipt-kv-block">
                <div className="receipt-kv-label">Partial lines</div>
                <div className="receipt-kv-value" style={{ fontWeight: 600, color: "#000" }}>
                  {(receiptData.items || []).filter((it) => {
                    const t = getItemLineTotal(it)
                    return toNum(it.paid_amount) > 0 && toNum(it.paid_amount) < t
                  }).length}{" "}
                  items *
                </div>
              </div>
            ) : null}
          </div>

          {receiptData.notes ? (
            <div
              style={{
                marginBottom: "8px",
                padding: "5px 6px",
                border: "1px dashed #000",
                fontSize: "8px",
                lineHeight: 1.3,
                color: "#000",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: "2px", fontSize: "8px" }}>Notes</div>
              <div
                className="receipt-kv-value"
                style={{
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  fontSize: "8px",
                  color: "#000",
                }}
              >
                {receiptData.notes}
              </div>
            </div>
          ) : null}

          <div
            className="receipt-footer text-center"
            style={{ borderTop: "1px dashed #000", paddingTop: "6px", fontSize: "8px", color: "#000" }}
          >
            <p style={{ margin: "2px 0", color: "#000" }}>Thank you for your purchase.</p>
            <p style={{ margin: "2px 0", fontSize: "7px", color: "#000" }}>We hope to see you again soon.</p>
          </div>
        </div>
      </div>
      <div className="shrink-0 flex flex-col gap-2 sm:flex-row sm:justify-end pt-2 border-t bg-white">
        <Button variant="outline" onClick={handlePrint} aria-label="Print" title="Print">
          <Printer className="h-5 w-5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" aria-label="Download" title="Download">
              <Download className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Download as PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadImage}>
              <Image className="h-4 w-4 mr-2" />
              Download as Image
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {onClose && (
          <Button onClick={onClose}>Close</Button>
        )}
      </div>
    </>
  )
}

