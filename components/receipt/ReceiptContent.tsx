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

  // Calculate item total (for display)
  const calculateItemTotal = (item: ReceiptItem) => {
    const price = item.unit_price || 0
    const quantity = item.quantity || 0
    const discount = ((item.discount_percent || 0) / 100)
    return price * quantity * (1 - discount)
  }

  // Calculate financial summary
  const calculateFinancials = () => {
    // If using POS cart data (has subtotal, tax, etc.)
    if (receiptData.subtotal !== undefined) {
      return {
        subtotal: receiptData.subtotal,
        globalDiscountAmount: receiptData.globalDiscountAmount || 0,
        tax: receiptData.tax || 0,
        total: receiptData.total || receiptData.total_amount,
        totalPaid: receiptData.total_paid || 0,
        totalUnpaid: receiptData.totalUnpaidAmount || 0,
      }
    }

    // Otherwise calculate from items (for invoice-based receipts)
    const subtotal = (receiptData.items || []).reduce((sum, item) => sum + calculateItemTotal(item), 0)
    const globalDiscountPercent = receiptData.global_discount_percent || 0
    const globalDiscountAmount = (subtotal * globalDiscountPercent) / 100
    const discountedSubtotal = subtotal - globalDiscountAmount
    const taxPercent = receiptData.tax_percent || 0
    const tax = discountedSubtotal * (taxPercent / 100)
    const total = discountedSubtotal + tax
    const totalPaid = receiptData.total_paid || 0
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
  const globalDiscountPercent = receiptData.global_discount_percent || 
    (financials.subtotal > 0 ? (financials.globalDiscountAmount / financials.subtotal) * 100 : 0)
  const taxPercent = receiptData.tax_percent || 
    (financials.subtotal > 0 ? (financials.tax / financials.subtotal) * 100 : 0)

  // Determine payment status for items
  const isFullyPaid = Math.abs((financials.totalPaid || 0) - financials.total) < 0.001

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
                  line-height: 1.45; 
                  margin: 0; 
                  padding: 12px; 
                  width: 100%; 
                }
                .receipt-container { 
                  width: 100% !important; 
                  max-width: 100% !important; 
                  margin: 0 !important; 
                  padding: 0 !important; 
                }
                .receipt-section-title {
                  border-bottom: 1px solid #000 !important;
                  padding-bottom: 4px !important;
                  margin-bottom: 6px !important;
                }
                .receipt-kv-value, .receipt-item-name {
                  word-wrap: break-word !important;
                  overflow-wrap: anywhere !important;
                  white-space: normal !important;
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
                line-height: 1.45; 
                margin: 0; 
                padding: 12px; 
                width: 100%; 
              }
              .receipt-section-title {
                font-weight: bold;
                font-size: 10px;
                letter-spacing: 0.02em;
                border-bottom: 1px solid #000;
                padding-bottom: 4px;
                margin-bottom: 6px;
              }
              .receipt-kv-block { margin-bottom: 8px; }
              .receipt-kv-label { font-weight: 600; font-size: 8px; color: #333; margin-bottom: 2px; }
              .receipt-kv-value {
                font-size: 10px;
                word-wrap: break-word;
                overflow-wrap: anywhere;
                white-space: normal;
              }
              .receipt-item-block {
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 8px;
                margin-bottom: 8px;
              }
              .receipt-item-name {
                font-weight: 600;
                font-size: 10px;
                margin-bottom: 6px;
                word-wrap: break-word;
                overflow-wrap: anywhere;
                white-space: normal;
              }
              .receipt-item-row { display: flex; justify-content: space-between; font-size: 9px; margin-top: 3px; gap: 8px; }
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
        .receipt-container .receipt-section-title {
          font-weight: bold;
          font-size: 10px;
          letter-spacing: 0.02em;
          border-bottom: 1px solid #000;
          padding-bottom: 4px;
          margin-bottom: 6px;
        }
        .receipt-container .receipt-kv-block { margin-bottom: 8px; }
        .receipt-container .receipt-kv-label {
          font-weight: 600;
          font-size: 8px;
          color: #333;
          margin-bottom: 2px;
        }
        .receipt-container .receipt-kv-value {
          font-size: 10px;
          word-wrap: break-word;
          overflow-wrap: anywhere;
          white-space: normal;
        }
        .receipt-container .receipt-item-block {
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 8px;
          margin-bottom: 8px;
        }
        .receipt-container .receipt-item-name {
          font-weight: 600;
          font-size: 10px;
          margin-bottom: 6px;
          word-wrap: break-word;
          overflow-wrap: anywhere;
          white-space: normal;
        }
        .receipt-container .receipt-item-row {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          margin-top: 3px;
          gap: 8px;
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
            padding: "12px",
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: "10px",
            lineHeight: 1.45,
            backgroundColor: "white",
            minHeight: "100%",
            wordWrap: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          <div
            className="receipt-header text-center mb-3"
            style={{ borderBottom: "1px dashed #000", paddingBottom: "10px" }}
          >
            <div style={{ marginBottom: "6px", display: "flex", justifyContent: "center", alignItems: "center" }}>
              <img
                src="/dararab-logo-1.png"
                alt="DarArab Logo"
                style={{
                  maxWidth: "64px",
                  maxHeight: "44px",
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
            <h2 style={{ fontSize: "13px", fontWeight: "bold", margin: "0 0 6px 0", lineHeight: 1.3 }}>
              DarArab for Publishing & Translation
            </h2>
            <div
              style={{
                fontSize: "9px",
                margin: "4px 0",
                whiteSpace: "normal",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              Seeb, Muscat, Sultanate of Oman
            </div>
            <div style={{ fontSize: "9px", margin: "4px 0" }}>Tel: +96871523542</div>
            <div
              style={{
                fontSize: "9px",
                margin: "4px 0",
                whiteSpace: "normal",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              Email: info@dararab.co.uk
            </div>
            <div style={{ fontSize: "9px", margin: "4px 0" }}>Web: dararab.co.uk</div>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <div className="receipt-section-title">Receipt details</div>
            <div className="receipt-kv-block">
              <div className="receipt-kv-label">Receipt number</div>
              <div className="receipt-kv-value">
                {receiptData.composite_id ? receiptData.composite_id : `#${receiptData.id}`}
              </div>
            </div>
            <div className="receipt-kv-block">
              <div className="receipt-kv-label">Date</div>
              <div className="receipt-kv-value">
                {receiptData.created_at_formatted || format(new Date(), "PPP")}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <div className="receipt-section-title">Customer</div>
            <div className="receipt-kv-block">
              <div className="receipt-kv-label">Name</div>
              <div className="receipt-kv-value">{receiptData.customer_name || "Walk-in Customer"}</div>
            </div>
            {receiptData.customer_contact ? (
              <div className="receipt-kv-block">
                <div className="receipt-kv-label">Contact</div>
                <div className="receipt-kv-value">{receiptData.customer_contact}</div>
              </div>
            ) : null}
          </div>

          <div style={{ marginBottom: "14px" }}>
            <div className="receipt-section-title">Sale information</div>
            <div className="receipt-kv-block">
              <div className="receipt-kv-label">Payment method</div>
              <div className="receipt-kv-value">{receiptData.payment_method_name || "N/A"}</div>
            </div>
            <div className="receipt-kv-block">
              <div className="receipt-kv-label">Invoice type</div>
              <div className="receipt-kv-value">{receiptData.invoice_type_name || "N/A"}</div>
            </div>
            <div className="receipt-kv-block">
              <div className="receipt-kv-label">Warehouse</div>
              <div className="receipt-kv-value">{receiptData.warehouse_name || "N/A"}</div>
            </div>
            {receiptData.warehouse_location ? (
              <div className="receipt-kv-block">
                <div className="receipt-kv-label">Location</div>
                <div className="receipt-kv-value">{receiptData.warehouse_location}</div>
              </div>
            ) : null}
          </div>

          <div style={{ marginBottom: "14px" }}>
            <div className="receipt-section-title">Items</div>
            {(receiptData.items || []).map((item, idx) => {
              const itemTotal = calculateItemTotal(item)
              const itemDiscountPercent = item.discount_percent || 0

              let status = "Not Paid"
              let statusColor = "#dc2626"

              if (isFullyPaid) {
                status = "Paid"
                statusColor = "#16a34a"
              } else if (item.is_paid || (item.paid_amount && item.paid_amount > 0)) {
                const itemPaid = item.paid_amount || 0
                if (itemPaid >= itemTotal) {
                  status = "Paid"
                  statusColor = "#16a34a"
                } else {
                  status = "Partial"
                  statusColor = "#ea580c"
                }
              } else if (financials.totalPaid > 0) {
                status = "Partial"
                statusColor = "#ea580c"
              }

              const displayPrice = item.product ? getDisplayPrice(item) : null
              const displayPriceValue = displayPrice ? parseFloat(displayPrice) : item.unit_price || 0
              const productLabel = item.product_name || item.product?.title_en || "Unknown Product"

              return (
                <div key={idx} className="receipt-item-block">
                  <div className="receipt-item-name">{productLabel}</div>
                  <div className="receipt-item-row">
                    <span>Quantity</span>
                    <span>{item.quantity || 0}</span>
                  </div>
                  <div className="receipt-item-row">
                    <span>Unit price</span>
                    <span>
                      {displayPriceValue.toFixed(3)} {currencyLabel}
                    </span>
                  </div>
                  <div className="receipt-item-row">
                    <span>Line discount</span>
                    <span>{itemDiscountPercent.toFixed(1)}%</span>
                  </div>
                  <div className="receipt-item-row" style={{ fontWeight: 600 }}>
                    <span>Line total</span>
                    <span>
                      {itemTotal.toFixed(3)} {currencyLabel}
                    </span>
                  </div>
                  <div className="receipt-item-row" style={{ marginTop: "6px" }}>
                    <span>Payment status</span>
                    <span style={{ color: statusColor, fontWeight: 600 }}>{status}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginBottom: "14px" }}>
            <div className="receipt-section-title">Totals</div>
            <div className="receipt-kv-block">
              <div className="receipt-kv-label">Subtotal</div>
              <div className="receipt-kv-value">
                {financials.subtotal.toFixed(3)} {currencyLabel}
              </div>
            </div>
            {globalDiscountPercent > 0 ? (
              <div className="receipt-kv-block">
                <div className="receipt-kv-label">Global discount ({globalDiscountPercent.toFixed(1)}%)</div>
                <div className="receipt-kv-value" style={{ color: "#16a34a" }}>
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
            <div className="receipt-kv-block" style={{ borderTop: "1px solid #000", paddingTop: "8px", marginTop: "6px" }}>
              <div className="receipt-kv-label">Invoice total</div>
              <div className="receipt-kv-value" style={{ fontWeight: 700, fontSize: "11px" }}>
                {financials.total.toFixed(3)} {currencyLabel}
              </div>
            </div>
            <div className="receipt-kv-block">
              <div className="receipt-kv-label">Total paid</div>
              <div className="receipt-kv-value" style={{ color: "#16a34a" }}>
                {financials.totalPaid.toFixed(3)} {currencyLabel}
              </div>
            </div>
            <div className="receipt-kv-block">
              <div className="receipt-kv-label">Amount due</div>
              <div
                className="receipt-kv-value"
                style={{
                  fontWeight: 700,
                  color: financials.totalUnpaid > 0 ? "#dc2626" : "#16a34a",
                }}
              >
                {financials.totalUnpaid.toFixed(3)} {currencyLabel}
              </div>
            </div>
            {receiptData.hasPartialPayment ? (
              <div className="receipt-kv-block">
                <div className="receipt-kv-label">Lines with partial payment</div>
                <div className="receipt-kv-value" style={{ color: "#ea580c" }}>
                  {(receiptData.items || []).filter((it) => {
                    const t = calculateItemTotal(it)
                    return (it.paid_amount || 0) > 0 && (it.paid_amount || 0) < t
                  }).length}{" "}
                  items
                </div>
              </div>
            ) : null}
          </div>

          {receiptData.notes ? (
            <div style={{ marginBottom: "14px", padding: "10px", border: "1px dashed #000" }}>
              <div className="receipt-section-title" style={{ borderBottom: "none", marginBottom: "6px" }}>
                Notes
              </div>
              <div
                className="receipt-kv-value"
                style={{ whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere" }}
              >
                {receiptData.notes}
              </div>
            </div>
          ) : null}

          <div
            className="receipt-footer text-center"
            style={{ borderTop: "1px dashed #000", paddingTop: "10px", fontSize: "9px" }}
          >
            <p style={{ margin: "4px 0" }}>Thank you for your purchase.</p>
            <p style={{ margin: "4px 0", fontSize: "8px", color: "#555" }}>We hope to see you again soon.</p>
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

