"use client"

import { useState, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Printer, Download, FileText, Image } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { format } from "date-fns"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"
import jsPDF from "jspdf"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

interface InvoiceItem {
  id?: number;
  product?: {
    id: number;
  title_en: string;
    title_ar: string;
  isbn: string;
  };
  product_name: string; // Product name from API
  quantity: number;
  unit_price: number;
  discount_percent: number;
  total_price: number;
  paid_amount?: number; // Payment amount for this item
  is_paid?: boolean; // Payment status for this item
}

interface InvoiceData {
  id: number;
  composite_id: string;
  customer_name: string;
  customer_type?: string;
  customer_contact: string;
  warehouse_name: string;
  invoice_type_name: string;
  payment_method_name: string;
  is_returnable: boolean;
  items: InvoiceItem[];
  total_amount: number;
  total_paid: number;
  remaining_amount: number;
  notes: string;
  created_at_formatted: string;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
  global_discount_percent?: number;
  tax_percent?: number;
}

export default function ReceiptPage() {
  const searchParams = useSearchParams()
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  // Get invoiceId from URL parameters
  const currentInvoiceId = searchParams.get('id')

  // Fetch invoice data by ID
  const fetchInvoiceData = async (id: string) => {
    try {
      setIsLoading(true);
      console.log("Fetching invoice data for ID:", id);
      const token = localStorage.getItem("accessToken");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const response = await fetch(`${API_URL}/sales/invoices/${id}/summary/`, { headers });
      
      if (!response.ok) {
        throw new Error("Failed to fetch invoice data");
      }

      const data = await response.json();
      console.log("Invoice data received:", data);
      console.log("Invoice items:", data.items);
      console.log("Financial data:", {
        subtotal: data.subtotal,
        total_amount: data.total_amount,
        total_paid: data.total_paid,
        total_remaining: data.total_remaining,
        global_discount_percent: data.global_discount_percent,
        tax_percent: data.tax_percent
      });
      if (data.items && data.items.length > 0) {
        console.log("First item structure:", data.items[0]);
        console.log("Payment data for first item:", {
          product_name: data.items[0].product_name,
          total_price: data.items[0].total_price,
          unit_price: data.items[0].unit_price,
          quantity: data.items[0].quantity
        });
        console.log("All items payment status:", data.items.map((item: InvoiceItem) => ({
          product_name: item.product_name,
          total_price: item.total_price,
          unit_price: item.unit_price,
          quantity: item.quantity
        })));
      }
      setInvoiceData(data);
    } catch (error) {
      console.error("Error fetching invoice data:", error);
      toast({
        title: "Error",
        description: "Failed to load invoice data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch invoice data when component mounts or invoiceId changes
  useEffect(() => {
    if (currentInvoiceId) {
      fetchInvoiceData(currentInvoiceId);
        } else {
      setIsLoading(false);
    }
  }, [currentInvoiceId]);

  const handleClose = () => {
    setIsPrintDialogOpen(false)
    // Navigate back to invoices page
    window.history.back()
  }

  // Print function
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
            logging: true,
            width: printRef.current?.scrollWidth,
            height: printRef.current?.scrollHeight
          }).then(canvas => {
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            
            const doc = new jsPDF({
              unit: 'px',
              format: [imgWidth, imgHeight],
              orientation: imgHeight > imgWidth ? 'portrait' : 'landscape'
            });
            
            const imgData = canvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            doc.save('receipt.pdf');
          }).catch(error => {
            console.error('Error generating PDF:', error)
          });
        }, 500)
      });
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
            logging: true,
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

  if (isLoading) {
  return (
      <Dialog open={isPrintDialogOpen} onOpenChange={handleClose}>
        <DialogContent className="w-full max-w-md h-[90vh] flex flex-col">
          <div className="shrink-0">
                          <DialogHeader>
              <DialogTitle>Receipt</DialogTitle>
              <DialogDescription>Loading receipt data...</DialogDescription>
                          </DialogHeader>
                            </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading receipt...</span>
                            </div>
                            </div>
                        </DialogContent>
                      </Dialog>
    );
  }

  if (!invoiceData) {
                          return (
      <Dialog open={isPrintDialogOpen} onOpenChange={handleClose}>
        <DialogContent className="w-full max-w-md h-[90vh] flex flex-col">
          <div className="shrink-0">
            <DialogHeader>
              <DialogTitle>Receipt</DialogTitle>
              <DialogDescription>Unable to load receipt data</DialogDescription>
            </DialogHeader>
                </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">No Invoice Data</h2>
              <p className="text-muted-foreground">Unable to load invoice data. Please check the invoice ID.</p>
                </div>
                </div>
          <div className="shrink-0 flex justify-end pt-2 border-t">
            <Button onClick={handleClose}>Close</Button>
                  </div>
          </DialogContent>
        </Dialog>
    );
  }

  return (
    <Dialog open={isPrintDialogOpen} onOpenChange={handleClose}>
        <DialogContent className="w-full max-w-md h-[90vh] flex flex-col">
          <div className="shrink-0">
            <DialogHeader>
              <DialogTitle>Receipt</DialogTitle>
              <DialogDescription>View, print, or download your receipt.</DialogDescription>
            </DialogHeader>
          </div>
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
                    filter: 'grayscale(100%) contrast(200%)', // Make it print-friendly
                    display: 'block'
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
              <h2 style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 3px 0' }}>DarArab for Publishing & Translation</h2>
                <p style={{ fontSize: '9px', margin: '2px 0' }}>Seeb, Muscat, Sultanate of Oman</p>
                <p style={{ fontSize: '9px', margin: '2px 0' }}>Tel: +96871523542</p>
                <p style={{ fontSize: '9px', margin: '2px 0' }}>Email: info@dararab.co.uk | Web: dararab.co.uk</p>
              <p style={{ fontSize: '9px', margin: '3px 0 0 0' }}>Receipt #{invoiceData.id}</p>
              <p style={{ fontSize: '9px', margin: '2px 0' }}>{invoiceData.created_at_formatted || format(new Date(), "PPP")}</p>
              </div>
              
              <div className="mb-2" style={{ fontSize: '9px' }}>
              <p style={{ margin: '2px 0' }}><strong>Customer:</strong> {invoiceData.customer_name || "Walk-in Customer"}</p>
              {invoiceData.customer_contact && (
                <p style={{ margin: '2px 0', fontSize: '8px' }}>{invoiceData.customer_contact}</p>
              )}
              <p style={{ margin: '2px 0' }}><strong>Payment:</strong> {invoiceData.payment_method_name || "N/A"}</p>
              <p style={{ margin: '2px 0' }}><strong>Type:</strong> {invoiceData.invoice_type_name || "N/A"}</p>
              <p style={{ margin: '2px 0' }}><strong>Warehouse:</strong> {invoiceData.warehouse_name || "N/A"}</p>
              </div>
              
              <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', marginBottom: '3px' }}>
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Price</span>
                  <span>Total</span>
                  <span>Status</span>
                </div>
                
              {(() => {
                // Calculate totals first
                const calculateItemTotal = (item: InvoiceItem) => {
                  const price = item.unit_price || 0;
                  const quantity = item.quantity || 0;
                  const discount = (item.discount_percent || 0) / 100;
                  return price * quantity * (1 - discount);
                };
                
                const subtotal = (invoiceData.items || []).reduce((sum, item) => sum + calculateItemTotal(item), 0);
                const globalDiscountPercent = invoiceData.global_discount_percent || 0;
                const globalDiscountAmount = (subtotal * globalDiscountPercent) / 100;
                const discountedSubtotal = subtotal - globalDiscountAmount;
                const taxPercent = invoiceData.tax_percent || 0;
                const tax = discountedSubtotal * (taxPercent / 100);
                const finalTotal = discountedSubtotal + tax;
                
                // Determine if invoice is fully paid
                const isFullyPaid = Math.abs(invoiceData.total_paid - finalTotal) < 0.001;
                
                return (invoiceData.items || []).map((item, idx) => {
                  const itemTotal = calculateItemTotal(item);
                  
                  let status = "Outstanding";
                  let statusColor = "#dc2626";
                  
                  if (isFullyPaid) {
                    status = "Paid";
                    statusColor = "#16a34a";
                  } else if (invoiceData.total_paid > 0) {
                    status = "Partial";
                    statusColor = "#ea580c";
                  }
                  
                  return (
                  <div key={`${item.product_name}-${idx}`} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      fontSize: '8px',
                      marginBottom: '2px',
                      paddingBottom: '2px',
                      borderBottom: '1px dotted #ccc'
                    }}>
                      <div style={{ flex: '2', wordBreak: 'break-word', marginRight: '2px' }}>
                      {item.product_name || 'Unknown Product'}
                      </div>
                    <div style={{ flex: '0.3', textAlign: 'center' }}>{item.quantity || 0}</div>
                    <div style={{ flex: '0.5', textAlign: 'right' }}>{(item.unit_price || 0).toFixed(3)}</div>
                    <div style={{ flex: '0.5', textAlign: 'right' }}>{itemTotal.toFixed(3)}</div>
                      <div style={{ flex: '0.4', textAlign: 'right', fontSize: '7px' }}>
                        <span style={{ color: statusColor }}>{status}</span>
                      </div>
                    </div>
                  );
                });
              })()}
              </div>
              
              <div style={{ marginTop: '6px', fontSize: '9px' }}>
              {(() => {
                // Recalculate totals for financial summary
                const calculateItemTotal = (item: InvoiceItem) => {
                  const price = item.unit_price || 0;
                  const quantity = item.quantity || 0;
                  const discount = (item.discount_percent || 0) / 100;
                  return price * quantity * (1 - discount);
                };
                
                const subtotal = (invoiceData.items || []).reduce((sum, item) => sum + calculateItemTotal(item), 0);
                const globalDiscountPercent = invoiceData.global_discount_percent || 0;
                const globalDiscountAmount = (subtotal * globalDiscountPercent) / 100;
                const discountedSubtotal = subtotal - globalDiscountAmount;
                const taxPercent = invoiceData.tax_percent || 0;
                const tax = discountedSubtotal * (taxPercent / 100);
                const total = discountedSubtotal + tax;
                
                // Payment calculations - use invoice-level data from API
                const totalPaidAmount = invoiceData.total_paid || 0;
                // Amount due is the difference between final total and total paid
                const totalUnpaidAmount = Math.max(0, total - totalPaidAmount);
                
                return (
                  <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>Subtotal:</span>
                  <span>{subtotal.toFixed(3)} OMR</span>
                </div>
                    {globalDiscountPercent > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span>Discount ({globalDiscountPercent}%):</span>
                    <span style={{ color: '#16a34a' }}>-{globalDiscountAmount.toFixed(3)} OMR</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span>Tax ({taxPercent}%):</span>
                  <span>{tax.toFixed(3)} OMR</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '2px' }}>
                  <span>TOTAL:</span>
                  <span>{subtotal.toFixed(3)} OMR</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>Total Paid:</span>
                      <span style={{ color: '#16a34a' }}>{total.toFixed(3)} OMR</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 'bold' }}>
                  <span>Amount Due:</span>
                  <span style={{ color: totalUnpaidAmount > 0 ? '#dc2626' : '#16a34a' }}>{totalUnpaidAmount.toFixed(3)} OMR</span>
                </div>
                  </>
                );
              })()}
              </div>
              
            {invoiceData.notes && (
                <div style={{ marginTop: '6px', padding: '4px', border: '1px dashed #000', fontSize: '8px' }}>
                  <p style={{ margin: '0', fontWeight: 'bold' }}>Notes:</p>
                <p style={{ margin: '2px 0 0 0' }}>{invoiceData.notes}</p>
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
          <Button onClick={handleClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
  )
}
