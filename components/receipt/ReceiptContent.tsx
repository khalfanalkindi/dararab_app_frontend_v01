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

interface ReceiptItem {
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

interface ReceiptData {
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
                  font-family: monospace; 
                  font-size: 12px; 
                  line-height: 1.3; 
                  margin: 0; 
                  padding: 15px; 
                  width: 100%; 
                }
                .receipt-container { 
                  width: 100% !important; 
                  max-width: 100% !important; 
                  margin: 0 !important; 
                  padding: 0 !important; 
                }
                img {
                  -webkit-print-color-adjust: exact !important;
                  color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
              body { 
                font-family: monospace; 
                font-size: 12px; 
                line-height: 1.3; 
                margin: 0; 
                padding: 15px; 
                width: 100%; 
              }
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
        <div className="receipt-container" style={{
          width: '280px',
          maxWidth: '280px',
          margin: '0 auto',
          padding: '8px',
          fontFamily: 'monospace',
          fontSize: '10px',
          lineHeight: '1.1',
          backgroundColor: 'white',
          minHeight: '100%'
        }}>
          <div className="receipt-header text-center mb-2" style={{ borderBottom: '1px dashed #000', paddingBottom: '6px' }}>
            <div style={{ marginBottom: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img 
                src="/dararab-logo-1.png" 
                alt="DarArab Logo" 
                style={{ 
                  maxWidth: '60px', 
                  maxHeight: '40px', 
                  objectFit: 'contain',
                  filter: 'grayscale(100%) contrast(200%)',
                  display: 'block'
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
            </div>
            <h2 style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 3px 0' }}>DarArab for Publishing & Translation</h2>
            <p style={{ fontSize: '9px', margin: '2px 0' }}>Seeb, Muscat, Sultanate of Oman</p>
            <p style={{ fontSize: '9px', margin: '2px 0' }}>Tel: +96871523542</p>
            <p style={{ fontSize: '9px', margin: '2px 0' }}>Email: info@dararab.co.uk | Web: dararab.co.uk</p>
            <p style={{ fontSize: '9px', margin: '3px 0 0 0' }}>Receipt #{receiptData.id}</p>
            <p style={{ fontSize: '9px', margin: '2px 0' }}>{receiptData.created_at_formatted || format(new Date(), "PPP")}</p>
          </div>
          
          <div className="mb-2" style={{ fontSize: '9px' }}>
            <p style={{ margin: '2px 0' }}><strong>Customer:</strong> {receiptData.customer_name || "Walk-in Customer"}</p>
            {receiptData.customer_contact && (
              <p style={{ margin: '2px 0', fontSize: '8px' }}>{receiptData.customer_contact}</p>
            )}
            <p style={{ margin: '2px 0' }}><strong>Payment:</strong> {receiptData.payment_method_name || "N/A"}</p>
            <p style={{ margin: '2px 0' }}><strong>Type:</strong> {receiptData.invoice_type_name || "N/A"}</p>
            <p style={{ margin: '2px 0' }}><strong>Warehouse:</strong> {receiptData.warehouse_name || "N/A"}</p>
          </div>
          
          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '6px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', marginBottom: '3px' }}>
              <span>Item</span>
              <span>Qty</span>
              <span>Price</span>
              <span>Disc%</span>
              <span>Total</span>
              <span>Status</span>
            </div>
            
            {(receiptData.items || []).map((item, idx) => {
              const itemTotal = calculateItemTotal(item)
              const itemDiscountPercent = item.discount_percent || 0
              
              // Determine status
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
              
              // Get display price (OMR or $)
              const displayPrice = item.product ? getDisplayPrice(item) : null
              const displayPriceValue = displayPrice ? parseFloat(displayPrice) : item.unit_price || 0
              
              return (
                <div key={idx} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  fontSize: '8px',
                  marginBottom: '2px',
                  paddingBottom: '2px',
                  borderBottom: '1px dotted #ccc'
                }}>
                  <div style={{ flex: '1.8', wordBreak: 'break-word', marginRight: '2px' }}>
                    {item.product_name || item.product?.title_en || 'Unknown Product'}
                  </div>
                  <div style={{ flex: '0.3', textAlign: 'center' }}>{item.quantity || 0}</div>
                  <div style={{ flex: '0.4', textAlign: 'right' }}>{displayPriceValue.toFixed(3)}</div>
                  <div style={{ flex: '0.3', textAlign: 'right' }}>{itemDiscountPercent.toFixed(1)}%</div>
                  <div style={{ flex: '0.4', textAlign: 'right' }}>{itemTotal.toFixed(3)}</div>
                  <div style={{ flex: '0.35', textAlign: 'right', fontSize: '7px' }}>
                    <span style={{ color: statusColor }}>{status}</span>
                  </div>
                </div>
              )
            })}
          </div>
          
          <div style={{ marginTop: '6px', fontSize: '9px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>Subtotal:</span>
              <span>{financials.subtotal.toFixed(3)} {currencyLabel}</span>
            </div>
            {globalDiscountPercent > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Discount ({globalDiscountPercent.toFixed(1)}%):</span>
                <span style={{ color: '#16a34a' }}>-{financials.globalDiscountAmount.toFixed(3)} {currencyLabel}</span>
              </div>
            )}
            {taxPercent > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Tax ({taxPercent.toFixed(1)}%):</span>
                <span>{financials.tax.toFixed(3)} {currencyLabel}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '2px' }}>
              <span>TOTAL:</span>
              <span>{financials.total.toFixed(3)} {currencyLabel}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>Total Paid:</span>
              <span style={{ color: '#16a34a' }}>{financials.totalPaid.toFixed(3)} {currencyLabel}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 'bold' }}>
              <span>Amount Due:</span>
              <span style={{ color: financials.totalUnpaid > 0 ? '#dc2626' : '#16a34a' }}>
                {financials.totalUnpaid.toFixed(3)} {currencyLabel}
              </span>
            </div>
            {receiptData.hasPartialPayment && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '8px' }}>
                <span style={{ color: '#ea580c' }}>Partial Payments:</span>
                <span style={{ color: '#ea580c' }}>
                  {(receiptData.items || []).filter(item => {
                    const itemTotal = calculateItemTotal(item)
                    return (item.paid_amount || 0) > 0 && (item.paid_amount || 0) < itemTotal
                  }).length} items
                </span>
              </div>
            )}
          </div>
          
          {receiptData.notes && (
            <div style={{ marginTop: '6px', padding: '4px', border: '1px dashed #000', fontSize: '8px' }}>
              <p style={{ margin: '0', fontWeight: 'bold' }}>Notes:</p>
              <p style={{ margin: '2px 0 0 0' }}>{receiptData.notes}</p>
            </div>
          )}
          
          <div className="receipt-footer text-center mt-2" style={{ borderTop: '1px dashed #000', paddingTop: '4px', fontSize: '8px' }}>
            <p style={{ margin: '2px 0' }}>Thank you for your purchase!</p>
            <p style={{ margin: '2px 0', fontSize: '7px' }}>Visit us again soon</p>
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

