"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { API_URL } from "@/lib/config"
import { ReceiptContent } from "@/components/receipt/ReceiptContent"
import type { ReceiptData } from "@/components/receipt/ReceiptContent"

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
  
  // AbortController ref for request cancellation
  const fetchInvoiceAbortControllerRef = useRef<AbortController | null>(null)

  // Get invoiceId from URL parameters
  const currentInvoiceId = searchParams.get('id')

  // Memoized headers to avoid recreating on every render
  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }), [])

  // Standardized error handling utility
  const handleError = useCallback((error: unknown, defaultMessage: string) => {
    // Silently handle AbortError (request cancellation)
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Request aborted')
      }
      return
    }

    const errorMessage = error instanceof Error ? error.message : defaultMessage
    
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error:', errorMessage, error)
    }
  }, [])

  // Retry utility function with exponential backoff
  const fetchWithRetry = useCallback(async (
    url: string,
    options: RequestInit = {},
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<Response> => {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check if request was aborted
        if (options.signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError')
        }
        
        const response = await fetch(url, options)
        
        // Don't retry on successful responses
        if (response.ok) {
          return response
        }
        
        // Don't retry on 4xx client errors (except 429 Too Many Requests)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return response // Return the error response without retrying
        }
        
        // For 5xx server errors or 429, throw to trigger retry
        if (response.status >= 500 || response.status === 429) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`)
        }
        
        // For other errors, return the response
        return response
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on AbortError
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error
        }
        
        // Don't retry if this was the last attempt
        if (attempt === maxRetries) {
          break
        }
        
        // Calculate exponential backoff delay: baseDelay * 2^attempt
        const delay = baseDelay * Math.pow(2, attempt)
        
        // Wait before retrying (respect abort signal)
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(resolve, delay)
          
          // If aborted during wait, clear timeout and reject
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId)
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            }, { once: true })
          }
        })
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Request failed after retries')
  }, [])

  // Fetch invoice data by ID
  const fetchInvoiceData = useCallback(async (id: string) => {
    // Cancel previous request if still pending
    if (fetchInvoiceAbortControllerRef.current) {
      fetchInvoiceAbortControllerRef.current.abort()
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController()
    fetchInvoiceAbortControllerRef.current = abortController
    
    try {
      setIsLoading(true);
      if (process.env.NODE_ENV !== 'production') {
        console.log("Fetching invoice data for ID:", id);
      }

      const response = await fetchWithRetry(`${API_URL}/sales/invoices/${id}/summary/`, { 
        headers,
        signal: abortController.signal
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch invoice data");
      }

      const data = await response.json();
      if (process.env.NODE_ENV !== 'production') {
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
      }
      setInvoiceData(data);
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      handleError(error, "Failed to fetch invoice data");
      toast({
        title: "Error",
        description: "Failed to load invoice data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [headers, fetchWithRetry, handleError]);

  // Fetch invoice data when component mounts or invoiceId changes
  useEffect(() => {
    if (currentInvoiceId) {
      fetchInvoiceData(currentInvoiceId);
    } else {
      setIsLoading(false);
    }
    
    // Cleanup: abort request when component unmounts or invoiceId changes
    return () => {
      if (fetchInvoiceAbortControllerRef.current) {
        fetchInvoiceAbortControllerRef.current.abort()
      }
    }
  }, [currentInvoiceId, fetchInvoiceData]);

  const handleClose = () => {
    setIsPrintDialogOpen(false)
    // Navigate back to invoices page
    window.history.back()
  }

  const lineItemTotal = useCallback((item: InvoiceItem) => {
    const price = item.unit_price || 0
    const quantity = item.quantity || 0
    const discount = (item.discount_percent || 0) / 100
    return price * quantity * (1 - discount)
  }, [])

  const receiptPayload = useMemo((): ReceiptData | null => {
    if (!invoiceData) return null
    const items = invoiceData.items || []
    const hasPartialPayment = items.some((item) => {
      const t = lineItemTotal(item)
      const p = item.paid_amount || 0
      return p > 0.001 && p < t - 0.001
    })
    return {
      id: invoiceData.id,
      composite_id: invoiceData.composite_id,
      customer_name: invoiceData.customer_name,
      customer_contact: invoiceData.customer_contact,
      warehouse_name: invoiceData.warehouse_name,
      invoice_type_name: invoiceData.invoice_type_name,
      payment_method_name: invoiceData.payment_method_name,
      items: items.map((it) => ({
        id: it.id,
        product_name: it.product_name,
        product: it.product,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount_percent: it.discount_percent,
        total_price: it.total_price,
        paid_amount: it.paid_amount,
        is_paid: it.is_paid,
      })),
      total_amount: invoiceData.total_amount,
      total_paid: invoiceData.total_paid,
      remaining_amount: invoiceData.remaining_amount,
      notes: invoiceData.notes,
      created_at_formatted: invoiceData.created_at_formatted,
      global_discount_percent: invoiceData.global_discount_percent,
      tax_percent: invoiceData.tax_percent,
      totalUnpaidAmount: invoiceData.remaining_amount,
      hasPartialPayment,
    }
  }, [invoiceData, lineItemTotal])

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
      <DialogContent className="flex max-h-[90vh] w-full max-w-md flex-col gap-0 overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0 space-y-1 pb-2">
          <DialogTitle>Receipt</DialogTitle>
          <DialogDescription>View, print, or download your receipt.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          {receiptPayload ? (
            <ReceiptContent
              receiptData={receiptPayload}
              currencyLabel="$"
              getDisplayPrice={() => null}
              onClose={handleClose}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
