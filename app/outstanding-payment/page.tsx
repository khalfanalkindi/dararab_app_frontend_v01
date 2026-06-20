"use client"

import Link from "next/link"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { AppSidebar } from "../../components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { FileText, Search, Plus, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { Checkbox } from "@/components/ui/checkbox"

import { API_URL } from "@/lib/config"
import {
  formatInvoiceUsdAmount,
  formatLineUsdAmount,
  sumSelectedOutstandingDisplay,
} from "@/lib/muscatCurrency"
import { ReceiptContent } from "@/components/receipt/ReceiptContent"
import { buildReceiptPayloadForDisplay } from "@/components/receipt/buildReceiptPayload"
import type { ReceiptData } from "@/components/receipt/ReceiptContent"

interface Customer {
  id: number
  institution_name?: string
  name_en?: string
  contact_person?: string
  phone?: string
  customer_type?: string
  type?: string
}

interface Warehouse {
  id: number
  name_en?: string
  name_ar?: string
  name?: string
  location?: string
}

interface Product {
  id: number
  name_en: string
  name_ar: string
  title?: string
  title_ar?: string
  price?: string | null
  price_omr?: string | null
  latest_price?: string | null
  latest_price_omr?: string | null
}

interface Invoice {
  id: number
  composite_id?: string // New field for display purposes
  customer_name: string
  customer_type: string | null
  customer_contact: string
  warehouse_name: string
  invoice_type_name: string
  payment_method_name: string
  is_returnable?: boolean
  items: InvoiceItem[]
  total_amount: number
  total_paid: number
  remaining_amount: number
  notes?: string
  created_at_formatted?: string
  created_by?: number
  updated_by?: number
  created_at: string
  updated_at?: string
  selected?: boolean
  status?: string
  // Nested objects from API
  customer?: Customer | null
  warehouse?: Warehouse | null
  invoice_type?: {
    id: number
    display_name_en?: string
    name_en?: string
    value?: string
  } | null
  payment_method?: {
    id: number
    display_name_en?: string
    name_en?: string
    value?: string
  } | null
}

interface InvoiceItem {
  id?: number
  product_name: string
  quantity?: number | string
  unit_price?: number | string
  discount_percent?: number | string
  tax_percent?: number | string
  total_price?: number | string
  paid_amount?: number | string
  remaining_amount?: number | string
  is_paid?: boolean
  selected?: boolean
  payment_status?: number
  payment_status_display?: string
  payment_summary?: any
  // Nested product object from API
  product?: Product | number
}

// API Response Types
interface OutstandingPaymentInvoiceResponse {
  id: number
  composite_id?: string
  customer?: Customer | null
  customer_name?: string
  customer_contact?: string
  customer_type?: string | null
  warehouse?: Warehouse | null
  warehouse_name?: string
  invoice_type?: {
    id: number
    display_name_en?: string
    name_en?: string
    value?: string
  } | null
  invoice_type_name?: string
  payment_method?: {
    id: number
    display_name_en?: string
    name_en?: string
    value?: string
  } | null
  payment_method_name?: string
  items?: InvoiceItem[]
  invoice_items?: InvoiceItem[]
  line_items?: InvoiceItem[]
  total_amount: number | string
  total_paid?: number | string
  total_paid_amount?: number | string
  remaining_amount?: number | string
  created_at?: string
  created_at_formatted?: string
  updated_at?: string
  notes?: string
  is_returnable?: boolean
}

interface InvoiceSummaryResponse {
  id: number
  composite_id?: string
  customer?: Customer | null
  customer_name?: string
  customer_contact?: string
  customer_type?: string | null
  warehouse?: Warehouse | null
  warehouse_name?: string
  invoice_type?: {
    id: number
    display_name_en?: string
    name_en?: string
    value?: string
  } | null
  invoice_type_name?: string
  payment_method?: {
    id: number
    display_name_en?: string
    name_en?: string
    value?: string
  } | null
  payment_method_name?: string
  items?: Array<{
    id?: number
    product?: Product | number
    product_name?: string
    quantity?: number | string
    unit_price?: number | string
    discount_percent?: number | string
    tax_percent?: number | string
    total_price?: number | string
    paid_amount?: number | string
    remaining_amount?: number | string
    is_paid?: boolean
  }>
  total_amount: number | string
  total_paid?: number | string
  remaining_amount?: number | string
  created_at?: string
  created_at_formatted?: string
  updated_at?: string
  notes?: string
  status?: string
}

interface InvoiceItemResponse {
  id: number
  product: Product | number
  product_name?: string
  quantity: number | string
  unit_price: number | string
  discount_percent: number | string
  tax_percent: number | string
  total_price: number | string
  paid_amount?: number | string
  remaining_amount?: number | string
  item_remaining_amount?: number | string
  is_paid?: boolean
  payment_status?: number
  payment_status_display?: string
  payment_summary?: any
}

interface PaymentMethodResponse {
  id: number
  value: string
  display_name_en: string
  display_name_ar?: string
  name_en?: string
  name_ar?: string
}

export default function OutstandingPaymentPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [showOnlyUnpaid, setShowOnlyUnpaid] = useState(false)

  // Individual operation loading states
  const [isViewingInvoice, setIsViewingInvoice] = useState(false)
  const [isCreatingBill, setIsCreatingBill] = useState(false)

  // Consolidated dialog state - only one dialog can be open at a time
  type DialogType = 'view' | 'generate' | 'confirm' | 'receipt' | null
  const [activeDialog, setActiveDialog] = useState<DialogType>(null)
  const [receiptPayload, setReceiptPayload] = useState<ReceiptData | null>(null)
  const [receiptCurrencyLabel, setReceiptCurrencyLabel] = useState("$")
  const [reopenMainInvoiceAfterReceipt, setReopenMainInvoiceAfterReceipt] = useState(false)

  // AbortController refs for request cancellation
  const warehousesAbortControllerRef = useRef<AbortController | null>(null)
  const customersAbortControllerRef = useRef<AbortController | null>(null)
  const invoicesAbortControllerRef = useRef<AbortController | null>(null)
  const invoiceDetailsAbortControllerRef = useRef<AbortController | null>(null)
  const billCreationAbortControllerRef = useRef<AbortController | null>(null)

  // Memoize headers to prevent recreation on every render
  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }), [])

  // Utility function for retry logic with exponential backoff
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
        
        // Don't retry on 4xx client errors (except 429 rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return response
        }
        
        // For 5xx errors or 429, throw to trigger retry
        if (response.status >= 500 || response.status === 429) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        return response
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Don't retry on AbortError
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error
        }
        
        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError
        }
        
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError || new Error('Unknown error in fetchWithRetry')
  }, [])

  // Standardized error handling utility
  const handleError = (
    error: unknown,
    defaultMessage: string,
    options?: {
      title?: string
      duration?: number
      onError?: (error: Error) => void
    }
  ) => {
    // Ignore abort errors silently
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }

    // Log error in development
    if (process.env.NODE_ENV !== 'production') {
      console.error("Error:", error)
    }

    // Extract error message
    let errorMessage = defaultMessage
    if (error instanceof Error) {
      errorMessage = error.message || defaultMessage
    }

    // Call custom error handler if provided
    if (options?.onError && error instanceof Error) {
      options.onError(error)
    }

    // Show toast notification
    toast({
      title: options?.title || "Error",
      description: errorMessage,
      variant: "destructive",
      duration: options?.duration || 5000,
    })
  }

  useEffect(() => {
    fetchWarehouses()
    fetchCustomers()
    
    // Cleanup: abort pending requests on unmount
    return () => {
      warehousesAbortControllerRef.current?.abort()
      customersAbortControllerRef.current?.abort()
      invoicesAbortControllerRef.current?.abort()
      invoiceDetailsAbortControllerRef.current?.abort()
      billCreationAbortControllerRef.current?.abort()
    }
  }, [])

  // Debounce search query to reduce API calls if auto-search is enabled
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300) // 300ms delay

    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchAllPaginated = useCallback(async <T,>(
    initialUrl: string,
    signal: AbortSignal,
  ): Promise<T[]> => {
    const normalizeList = (payload: unknown): T[] => {
      if (!payload) return []
      if (Array.isArray(payload)) return payload as T[]
      if (typeof payload === "object" && payload !== null && "results" in payload) {
        const results = (payload as { results?: unknown }).results
        if (Array.isArray(results)) return results as T[]
      }
      return []
    }

    const allItems: T[] = []
    let nextUrl: string | null = initialUrl

    while (nextUrl) {
      if (signal.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError")
      }
      const res = await fetchWithRetry(nextUrl, { headers, signal })
      if (!res.ok) {
        throw new Error(`Request failed (${res.status}) for ${nextUrl}`)
      }
      const data = await res.json()
      allItems.push(...normalizeList(data))
      nextUrl =
        typeof data === "object" &&
        data !== null &&
        typeof (data as { next?: unknown }).next === "string" &&
        (data as { next: string }).next
          ? (data as { next: string }).next
          : null
    }

    return allItems
  }, [headers, fetchWithRetry])

  const fetchWarehouses = async () => {
    // Abort previous request if still pending
    warehousesAbortControllerRef.current?.abort()
    warehousesAbortControllerRef.current = new AbortController()
    
    try {
      const res = await fetchWithRetry(
        `${API_URL}/inventory/warehouses/`,
        {
          headers,
          signal: warehousesAbortControllerRef.current.signal
        }
      )
      const data = await res.json()
      setWarehouses(Array.isArray(data) ? data : data.results || [])
    } catch (error) {
      handleError(error, "Failed to fetch warehouses")
    }
  }

  const fetchCustomers = async () => {
    customersAbortControllerRef.current?.abort()
    customersAbortControllerRef.current = new AbortController()

    setIsLoadingCustomers(true)
    try {
      const customersData = await fetchAllPaginated<Customer>(
        `${API_URL}/sales/customers/?page_size=1000`,
        customersAbortControllerRef.current.signal,
      )
      const sorted = [...customersData].sort((a, b) =>
        (a.institution_name || a.name_en || "").localeCompare(
          b.institution_name || b.name_en || "",
          undefined,
          { sensitivity: "base" },
        ),
      )
      setCustomers(sorted)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      handleError(error, "Failed to fetch customers")
      setCustomers([])
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  const fetchInvoices = async (options?: { search?: string; customerId?: number | null }) => {
    // Abort previous request if still pending
    invoicesAbortControllerRef.current?.abort()
    invoicesAbortControllerRef.current = new AbortController()
    
    setIsLoading(true)
    try {
      // Build query parameters
      const params = new URLSearchParams()
      
      if (selectedWarehouse) {
        params.append('warehouse', selectedWarehouse.toString())
      }
      
      if (dateRange?.from) {
        params.append('start_date', dateRange.from.toISOString().split('T')[0])
      }
      
      if (dateRange?.to) {
        params.append('end_date', dateRange.to.toISOString().split('T')[0])
      }
      
      const searchValue = options?.search !== undefined ? options.search : debouncedSearchQuery
      const customerId =
        options?.customerId !== undefined ? options.customerId : selectedCustomerId
      if (searchValue) {
        params.append('search', searchValue)
      }
      if (customerId) {
        params.append('customer_id', customerId.toString())
      }

      // Use the new outstanding payments endpoint
      const url = `${API_URL}/sales/invoices/outstanding-payments/${params.toString() ? `?${params.toString()}` : ''}`
      
      const response = await fetchWithRetry(url, {
        headers,
        signal: invoicesAbortControllerRef.current.signal
      })
      
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`
        if (response.status === 401) {
          errorMessage = 'Authentication required. Please log in again.'
        } else if (response.status === 403) {
          errorMessage = 'Access denied. You do not have permission to view this data.'
        }
        throw new Error(errorMessage)
      }
      
      const data = await response.json()
      
      // Transform API response to match our interface
      let transformedInvoices = []
      
      if (Array.isArray(data)) {
        transformedInvoices = data
      } else if (data.results && Array.isArray(data.results)) {
        transformedInvoices = data.results
      } else if (data.data && Array.isArray(data.data)) {
        transformedInvoices = data.data
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Unexpected API response structure:', data)
        }
        transformedInvoices = []
      }
      
      // Transform the data to match our interface structure
      const mappedInvoices = transformedInvoices.map((invoice: OutstandingPaymentInvoiceResponse) => {
        // Debug logging to see the actual structure
        if (process.env.NODE_ENV !== 'production') {
          console.log('Invoice structure:', invoice)
          console.log('Invoice total_amount:', invoice.total_amount)
          console.log('Invoice total_paid:', invoice.total_paid)
          console.log('Invoice remaining_amount:', invoice.remaining_amount)
          console.log('Invoice items:', invoice.items)
          console.log('Invoice invoice_items:', invoice.invoice_items)
          console.log('Invoice line_items:', invoice.line_items)
        }
        
        // Try multiple possible field names for items and map product names
        const mappedItems = (invoice.items || invoice.invoice_items || invoice.line_items || []).map((item: InvoiceItemResponse | InvoiceItem) => {
          const product = typeof item.product === 'object' && item.product !== null ? item.product : null
          return {
            ...item,
            // Map nested product object to flat product_name with multiple fallbacks
            product_name: (product && 'name_en' in product ? product.name_en : null) ||
                         (product && 'title_en' in product ? product.title_en : null) ||
                         (product && 'title' in product ? product.title : null) ||
                         (product && 'name' in product ? product.name : null) ||
                         ('product_name' in item ? item.product_name : null) ||
                         'No Product Name',
            // Keep the nested product object for reference
            product: item.product
          }
        })
        
        // Calculate actual totals from items (sum of item total_price) if items are available
        // If items are not in the list response (for performance), fall back to API totals
        let calculatedTotal: number
        let calculatedPaid: number
        let calculatedRemaining: number
        
        if (mappedItems.length > 0) {
          // Items are available, calculate from them
          calculatedTotal = mappedItems.reduce((sum: number, item) => {
            const itemTotal = typeof item.total_price === 'number' 
              ? item.total_price 
              : parseFloat(String(item.total_price || 0))
            return sum + itemTotal
          }, 0)
          
          calculatedPaid = mappedItems.reduce((sum: number, item) => {
            const itemPaid = typeof item.paid_amount === 'number'
              ? item.paid_amount
              : parseFloat(String(item.paid_amount || 0))
            return sum + itemPaid
          }, 0)
          
          calculatedRemaining = calculatedTotal - calculatedPaid
        } else {
          // Items not available in list response, use API totals from InvoiceSerializer
          // The InvoiceSerializer.get_total_amount() returns obj.total_amount (model property)
          // which should be the correct total after discounts
          const apiTotal = typeof invoice.total_amount === 'number' 
            ? invoice.total_amount 
            : parseFloat(String(invoice.total_amount || 0))
          
          const apiPaid = typeof invoice.total_paid === 'number' 
            ? invoice.total_paid 
            : typeof invoice.total_paid_amount === 'number'
            ? invoice.total_paid_amount
            : parseFloat(String(invoice.total_paid || invoice.total_paid_amount || 0))
          
          const apiRemaining = typeof invoice.remaining_amount === 'number'
            ? invoice.remaining_amount
            : apiTotal - apiPaid
          
          calculatedTotal = apiTotal
          calculatedPaid = apiPaid
          calculatedRemaining = Math.max(0, apiRemaining)
          
          if (process.env.NODE_ENV !== 'production') {
            console.log(`Invoice ${invoice.id}: Using API totals (items not in response)`, {
              total: calculatedTotal,
              paid: calculatedPaid,
              remaining: calculatedRemaining
            })
          }
        }
        
        return {
          ...invoice,
          // Use composite_id for display, fallback to id if not available
          composite_id: invoice.composite_id || invoice.id?.toString(),
          // Map nested customer object to flat properties
          customer_name: invoice.customer?.institution_name || 
                        invoice.customer?.name_en || 
                        invoice.customer_name || 
                        'No Customer',
          customer_contact: invoice.customer?.contact_person || 
                           invoice.customer?.phone || 
                           invoice.customer_contact || 
                           'No Contact Person',
          customer_type: invoice.customer?.customer_type || 
                        invoice.customer?.type || 
                        invoice.customer_type || 
                        null,
          // Map nested warehouse object to flat properties
          warehouse_name: invoice.warehouse?.name_en || 
                         invoice.warehouse?.name || 
                         invoice.warehouse_name || 
                         'No Warehouse',
          // Map nested invoice_type object to flat properties
          invoice_type_name: invoice.invoice_type?.display_name_en || 
                            invoice.invoice_type?.name_en || 
                            invoice.invoice_type?.value || 
                            invoice.invoice_type_name || 
                            'No Type',
          // Map nested payment_method object to flat properties
          payment_method_name: invoice.payment_method?.display_name_en || 
                              invoice.payment_method?.name_en || 
                              invoice.payment_method?.value || 
                              invoice.payment_method_name || 
                              'No Payment Method',
          // Use calculated totals from items instead of API totals (which might be subtotal_amount)
          total_amount: calculatedTotal,
          total_paid: calculatedPaid,
          remaining_amount: Math.max(0, calculatedRemaining),
          created_at: invoice.created_at || invoice.created_at_formatted || '',
          updated_at: invoice.updated_at || '',
          items: mappedItems,
          selected: false
        }
      })
      
      // The outstanding-payments endpoint already returns only invoices where is_fully_paid = False
      // No need for additional filtering since the endpoint handles this logic
      const filteredInvoices = customerId
        ? mappedInvoices.filter(
            (invoice: Invoice) =>
              invoice.customer?.id === customerId ||
              customers.find((c) => c.id === customerId)?.institution_name === invoice.customer_name,
          )
        : mappedInvoices
      setInvoices(filteredInvoices)
      setHasSearched(true)
    } catch (error) {
      handleError(error, "Failed to fetch invoices")
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewInvoice = async (
    invoice: Invoice,
    options?: { openDialog?: boolean },
  ) => {
    const openDialog = options?.openDialog !== false
    // Abort previous request if still pending
    invoiceDetailsAbortControllerRef.current?.abort()
    invoiceDetailsAbortControllerRef.current = new AbortController()
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Viewing invoice:', invoice)
      console.log('Invoice items:', invoice.items)
      
      // Debug: Log the structure of each item
      if (invoice.items && invoice.items.length > 0) {
        console.log('First item structure:', invoice.items[0])
        console.log('Item IDs:', invoice.items.map(item => ({ id: item.id, product_name: item.product_name })))
      }
    }
    
    // Always fetch the complete invoice details to ensure we have all the data
    setIsViewingInvoice(true)
    setIsLoadingItems(true)
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Fetching complete invoice details for:', invoice.id)
      }
      const response = await fetchWithRetry(
        `${API_URL}/sales/invoices/${invoice.id}/summary/`,
        {
          headers,
          signal: invoiceDetailsAbortControllerRef.current.signal
        }
      )
        
        if (response.ok) {
        const invoiceData: InvoiceSummaryResponse = await response.json()
        if (process.env.NODE_ENV !== 'production') {
          console.log('Fetched complete invoice:', invoiceData)
          console.log('Invoice data structure:', {
            customer_name: invoiceData.customer_name,
            customer_contact: invoiceData.customer_contact,
            customer: invoiceData.customer,
            invoice_type_name: invoiceData.invoice_type_name,
            invoice_type: invoiceData.invoice_type,
            payment_method_name: invoiceData.payment_method_name,
            payment_method: invoiceData.payment_method,
            warehouse_name: invoiceData.warehouse_name,
            warehouse: invoiceData.warehouse
          })
        }
        
        // Map the complete invoice data with robust field mapping for summary API
        const mappedInvoice = {
          ...invoiceData,
          // Use composite_id for display, fallback to id if not available
          composite_id: invoiceData.composite_id || invoice.composite_id || invoice.id?.toString(),
          // Map customer data with multiple fallbacks
          customer_name: invoiceData.customer_name || 
                        invoiceData.customer?.institution_name || 
                        invoiceData.customer?.name_en || 
                        invoice.customer_name || 
                        'No Customer',
          customer_contact: invoiceData.customer_contact || 
                           invoiceData.customer?.contact_person || 
                           invoiceData.customer?.phone || 
                           invoice.customer_contact || 
                           'No Contact Person',
          customer_type: invoiceData.customer_type || 
                        invoiceData.customer?.customer_type || 
                        invoice.customer_type || 
                        null,
          // Map warehouse data with multiple fallbacks
          warehouse_name: invoiceData.warehouse_name || 
                         invoiceData.warehouse?.name_en || 
                         invoiceData.warehouse?.name || 
                         invoice.warehouse_name || 
                         'No Warehouse',
          // Map invoice type data with multiple fallbacks - ensure it's not a product type
          invoice_type_name: (() => {
            const typeName = invoiceData.invoice_type_name || 
                            invoiceData.invoice_type?.display_name_en || 
                            invoiceData.invoice_type?.name_en || 
                            invoiceData.invoice_type?.value || 
                            invoice.invoice_type_name || 
                            'No Type'
            
            // Check if this looks like a product type (common product types that might be confused)
            const productTypes = ['novel', 'book', 'magazine', 'journal', 'textbook', 'fiction', 'non-fiction']
            if (productTypes.includes(typeName.toLowerCase())) {
              if (process.env.NODE_ENV !== 'production') {
                console.warn('Detected possible product type instead of invoice type:', typeName)
              }
              // Try to get the actual invoice type from the original invoice
              return invoice.invoice_type_name || 'No Type'
            }
            
            return typeName
          })(),
          // Map payment method data with multiple fallbacks
          payment_method_name: invoiceData.payment_method_name || 
                              invoiceData.payment_method?.display_name_en || 
                              invoiceData.payment_method?.name_en || 
                              invoiceData.payment_method?.value || 
                              invoice.payment_method_name || 
                              'No Payment Method',
          // Ensure other properties are properly mapped - use original invoice data for amounts if summary is wrong
          total_amount: invoiceData.total_amount || invoice.total_amount || 0,
          total_paid: invoiceData.total_paid || invoice.total_paid || 0,
          remaining_amount: invoiceData.remaining_amount || invoice.remaining_amount || 0,
          created_at: invoiceData.created_at || invoiceData.created_at_formatted || '',
          updated_at: invoiceData.updated_at || '',
          // Map items from summary API (items are already in the correct format)
          items: (invoiceData.items || []).map((item) => ({
            ...item,
            // The summary API already provides product_name, so we use it directly
            product_name: item.product_name || 'No Product Name',
            // Add missing fields that might be needed
            id: item.id,
            paid_amount: item.paid_amount || 0,
            remaining_amount: item.remaining_amount || item.total_price || 0,
            is_paid: item.is_paid || false,
            // Keep the original item data
            product: item.product
          })),
        }
        
        // Now fetch the detailed items to get payment status information
        try {
          if (process.env.NODE_ENV !== 'production') {
            console.log('Fetching detailed items for invoice:', invoice.id)
          }
          const itemsResponse = await fetchWithRetry(
            `${API_URL}/sales/invoices/${invoice.id}/items/`,
            {
              headers,
              signal: invoiceDetailsAbortControllerRef.current.signal
            }
          )
          
          if (itemsResponse.ok) {
            const itemsData: { results?: InvoiceItemResponse[], items?: InvoiceItemResponse[] } | InvoiceItemResponse[] = await itemsResponse.json()
            if (process.env.NODE_ENV !== 'production') {
              console.log('Fetched detailed items:', itemsData)
            }
            
            // Merge the detailed items data with the summary data
            const detailedItems: InvoiceItemResponse[] = Array.isArray(itemsData) 
              ? itemsData 
              : itemsData.results || itemsData.items || []
            if (process.env.NODE_ENV !== 'production') {
              console.log('Detailed items from API:', detailedItems)
            }
            
            const mergedItems = mappedInvoice.items.map((summaryItem, index: number) => {
              // Try to match by ID first, then by index
              const detailedItem = detailedItems.find((item) => item.id === summaryItem.id) || 
                                  detailedItems.find((item: any) => item.product === summaryItem.product) ||
                                  detailedItems[index]
              
              if (process.env.NODE_ENV !== 'production') {
                console.log(`Merging item ${index}:`, {
                  summaryItem,
                  detailedItem,
                  product: detailedItem?.product || summaryItem.product
                })
              }
              
              return {
                ...summaryItem,
                // Use detailed item data for payment information
                id: detailedItem?.id || summaryItem.id,
                paid_amount: detailedItem?.paid_amount || 0,
                remaining_amount: detailedItem?.remaining_amount || detailedItem?.item_remaining_amount || 0,
                is_paid: detailedItem?.is_paid || false,
                payment_status: detailedItem?.payment_status || 0,
                payment_status_display: detailedItem?.payment_status_display || 'Unknown',
                payment_summary: detailedItem?.payment_summary || null,
                // Keep the product name from summary
                product_name: summaryItem.product_name || 'No Product Name',
                // Keep the original item data - this is crucial for product ID
                product: detailedItem?.product || summaryItem.product
              }
            })
            
            // Calculate actual total from items (sum of item total_price)
            // This ensures we use the correct total after discounts, not the subtotal_amount
            const calculatedTotal = mergedItems.reduce((sum, item) => {
              const itemTotal = typeof item.total_price === 'number' 
                ? item.total_price 
                : parseFloat(String(item.total_price || 0))
              return sum + itemTotal
            }, 0)
            
            // Calculate total paid from items
            const calculatedPaid = mergedItems.reduce((sum, item) => {
              const itemPaid = typeof item.paid_amount === 'number'
                ? item.paid_amount
                : parseFloat(String(item.paid_amount || 0))
              return sum + itemPaid
            }, 0)
            
            const calculatedRemaining = calculatedTotal - calculatedPaid
            
            const finalInvoice: Invoice = {
              ...mappedInvoice,
              items: mergedItems,
              // Use calculated totals from items instead of API totals (which might be subtotal_amount)
              total_amount: calculatedTotal,
              total_paid: calculatedPaid,
              remaining_amount: Math.max(0, calculatedRemaining)
            }
            
            setSelectedInvoice(finalInvoice)
        } else {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('Failed to fetch detailed items for invoice:', invoice.id)
            }
            // Calculate actual total from items (sum of item total_price)
            const calculatedTotal = mappedInvoice.items.reduce((sum, item) => {
              const itemTotal = typeof item.total_price === 'number' 
                ? item.total_price 
                : parseFloat(String(item.total_price || 0))
              return sum + itemTotal
            }, 0)
            
            // Calculate total paid from items
            const calculatedPaid = mappedInvoice.items.reduce((sum, item) => {
              const itemPaid = typeof item.paid_amount === 'number'
                ? item.paid_amount
                : parseFloat(String(item.paid_amount || 0))
              return sum + itemPaid
            }, 0)
            
            const calculatedRemaining = calculatedTotal - calculatedPaid
            
            const mappedInvoiceTyped: Invoice = {
              ...mappedInvoice,
              // Use calculated totals from items instead of API totals
              total_amount: calculatedTotal,
              total_paid: calculatedPaid,
              remaining_amount: Math.max(0, calculatedRemaining)
            }
            setSelectedInvoice(mappedInvoiceTyped)
          }
        } catch (error) {
          // Non-critical error - detailed items fetch failed but we have summary data
          // Log silently and use the summary data we already have
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Error fetching detailed items (using summary data):', error)
          }
          // Calculate actual total from items (sum of item total_price)
          const calculatedTotal = mappedInvoice.items.reduce((sum, item) => {
            const itemTotal = typeof item.total_price === 'number' 
              ? item.total_price 
              : parseFloat(String(item.total_price || 0))
            return sum + itemTotal
          }, 0)
          
          // Calculate total paid from items
          const calculatedPaid = mappedInvoice.items.reduce((sum, item) => {
            const itemPaid = typeof item.paid_amount === 'number'
              ? item.paid_amount
              : parseFloat(String(item.paid_amount || 0))
            return sum + itemPaid
          }, 0)
          
          const calculatedRemaining = calculatedTotal - calculatedPaid
          
          const mappedInvoiceTyped: Invoice = {
            ...mappedInvoice,
            // Use calculated totals from items instead of API totals
            total_amount: calculatedTotal,
            total_paid: calculatedPaid,
            remaining_amount: Math.max(0, calculatedRemaining)
          }
          setSelectedInvoice(mappedInvoiceTyped)
        }
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to fetch complete invoice details for:', invoice.id)
        }
        setSelectedInvoice(invoice)
      }
    } catch (error) {
      handleError(error, 'Failed to fetch complete invoice details')
      setSelectedInvoice(invoice)
    } finally {
      setIsViewingInvoice(false)
      setIsLoadingItems(false)
    }
    
    // Note: We now always fetch complete invoice details above, so this section is no longer needed
    
    setShowOnlyUnpaid(false) // Reset filter when opening new invoice
    if (openDialog) {
      setActiveDialog('view')
    }
  }

  const handleCloseReceipt = () => {
    setReceiptPayload(null)
    setReceiptCurrencyLabel("$")
    if (reopenMainInvoiceAfterReceipt) {
      setReopenMainInvoiceAfterReceipt(false)
      setActiveDialog("view")
    } else {
      setActiveDialog(null)
      setSelectedInvoice(null)
    }
  }

  const handleResetFilters = () => {
    setSelectedWarehouse(null)
    setSelectedCustomerId(null)
    setDateRange(null)
    setSearchQuery("")
    setInvoices([])
    setHasSearched(false)
  }

  const handleInvoiceSelect = (invoiceId: number) => {
    setInvoices(invoices.map(invoice => 
      invoice.id === invoiceId 
        ? { ...invoice, selected: !invoice.selected }
        : invoice
    ))
  }

  // Calculate selected total using useMemo for efficiency (USD for logic)
  const selectedTotal = useMemo(() => {
    return invoices
      .filter(invoice => invoice.selected)
      .reduce((sum, invoice) => sum + (invoice.remaining_amount || 0), 0)
  }, [invoices])

  const selectedTotalDisplay = useMemo(
    () => sumSelectedOutstandingDisplay(invoices, warehouses),
    [invoices, warehouses],
  )

  const handleSearch = () => {
    fetchInvoices({ search: searchQuery, customerId: selectedCustomerId })
  }

  const handleItemSelect = (itemIndex: number) => {
    if (!selectedInvoice || !selectedInvoice.items) return

    const item = selectedInvoice.items[itemIndex]
    const isPaid = item.is_paid || Number(item.paid_amount) >= Number(item.total_price)
    
    // Don't allow selecting paid items
    if (isPaid) return

    const updatedItems = selectedInvoice.items.map((item, index) =>
      index === itemIndex ? { ...item, selected: !item.selected } : item
    )

    setSelectedInvoice({ ...selectedInvoice, items: updatedItems })
  }

  const handleGenerateNewBill = () => {
    if (!selectedInvoice || !selectedInvoice.items) return

    const selectedItems = selectedInvoice.items.filter(item => item.selected)
    if (selectedItems.length === 0) {
      toast({
        title: "No Items Selected",
        description: "Please select at least one item to generate a new bill",
        variant: "destructive",
      })
      return
    }

    setSelectedItems(selectedItems)
    setActiveDialog('generate')
  }

  const handleConfirmGenerateBill = () => {
    setActiveDialog('confirm')
  }

  const generateComposedId = (originalInvoiceId: number, newBillId: number) => {
    // Generate composite ID: main_invoice_id_child_bill_id
    // This matches the database format: 158_159
    return `${originalInvoiceId}_${newBillId}`
  }

  const formatInvoiceId = (invoice: Invoice) => {
    const displayId = invoice.composite_id || invoice.id.toString()
    const isChildInvoice = displayId.includes('_')
    
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium">{displayId}</span>
        {isChildInvoice && (
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
            Child
          </span>
        )}
      </div>
    )
  }

  // Rollback function for bill generation failures
  const rollbackBillCreation = async (
    invoiceId: number | undefined,
    invoiceItemIds: number[],
    paymentId: number | undefined,
    headers: HeadersInit,
    signal?: AbortSignal
  ) => {
    const rollbackErrors: string[] = []
    
    // Delete payment if created (best effort)
    if (paymentId !== undefined) {
      try {
        const deletePaymentResponse = await fetchWithRetry(
          `${API_URL}/sales/payments/${paymentId}/delete/`,
          {
            method: "DELETE",
            headers,
            signal,
          }
        )
        if (!deletePaymentResponse.ok) {
          rollbackErrors.push(`Failed to delete payment ${paymentId}`)
        }
      } catch (error) {
        rollbackErrors.push(
          `Error deleting payment ${paymentId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }
    
    // Delete invoice items in reverse order (best effort)
    for (const itemId of [...invoiceItemIds].reverse()) {
      try {
        const deleteResponse = await fetchWithRetry(
          `${API_URL}/sales/invoice-items/${itemId}/delete/`,
          {
            method: "DELETE",
            headers,
            signal,
          }
        )
        if (!deleteResponse.ok) {
          rollbackErrors.push(`Failed to delete invoice item ${itemId}`)
        }
      } catch (error) {
        rollbackErrors.push(
          `Error deleting invoice item ${itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }
    
    // Delete invoice (best effort)
    if (invoiceId !== undefined) {
      try {
        const deleteInvoiceResponse = await fetchWithRetry(
          `${API_URL}/sales/invoices/${invoiceId}/delete/`,
          {
            method: "DELETE",
            headers,
            signal,
          }
        )
        if (!deleteInvoiceResponse.ok) {
          rollbackErrors.push(`Failed to delete invoice ${invoiceId}`)
        }
      } catch (error) {
        rollbackErrors.push(
          `Error deleting invoice ${invoiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }
    
    if (rollbackErrors.length > 0 && process.env.NODE_ENV !== 'production') {
      console.error("Rollback errors:", rollbackErrors)
    }
    
    return rollbackErrors
  }

  const handleCreateNewBill = async () => {
    if (selectedItems.length === 0 || !selectedInvoice) {
      toast({
        title: "No Items Selected",
        description: "Please select at least one item to generate a new bill",
        variant: "destructive",
      })
      return
    }

    // Validate that we have the necessary data
    // Since we're using the summary API, we need to get the IDs from the original invoice list
    const originalInvoice = invoices.find(inv => inv.id === selectedInvoice.id)
    if (!originalInvoice?.customer?.id || !originalInvoice?.warehouse?.id) {
      toast({
        title: "Missing Data",
        description: "Customer or warehouse information is missing from the original invoice",
        variant: "destructive",
      })
      return
    }

    // Track created entities for potential rollback
    let invoiceId: number | undefined
    let createdInvoiceItemIds: number[] = []
    let createdPaymentId: number | undefined
    
    // Abort previous bill creation request if still pending
    billCreationAbortControllerRef.current?.abort()
    billCreationAbortControllerRef.current = new AbortController()
    
    try {
      setIsCreatingBill(true)
      const token = localStorage.getItem("accessToken")
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }

      const originalInvoiceId = selectedInvoice.id
      const totalAmount = selectedItems.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0)

      if (process.env.NODE_ENV !== 'production') {
        console.log("Selected items for new bill:", selectedItems)
        console.log("Original invoice data:", originalInvoice)
      }

      // Step 1: Get or create postpaid payment method (same as POS)
      let postpaidPaymentMethodId = null
      try {
        const paymentMethodsResponse = await fetchWithRetry(
          `${API_URL}/common/list-items/payment_method/`,
          {
            headers,
            signal: billCreationAbortControllerRef.current.signal
          }
        )
        if (paymentMethodsResponse.ok) {
          const paymentMethodsData = await paymentMethodsResponse.json()
          const paymentMethodsArray = Array.isArray(paymentMethodsData) ? paymentMethodsData : paymentMethodsData.results || []
          
          // Look for existing postpaid payment method
          const postpaidMethod = paymentMethodsArray.find((method: any) => 
            method.value === 'postpaid' || method.display_name_en.toLowerCase().includes('postpaid')
          )
          
          if (postpaidMethod) {
            postpaidPaymentMethodId = postpaidMethod.id
          } else {
            // Create new postpaid payment method
            const createPaymentMethodResponse = await fetchWithRetry(
              `${API_URL}/common/list-items/payment_method/`,
              {
                method: "POST",
                headers,
                body: JSON.stringify({
                  value: "postpaid",
                  display_name_en: "Postpaid",
                  display_name_ar: "مدفوع مسبقاً"
                }),
                signal: billCreationAbortControllerRef.current.signal
              }
            )
            
            if (createPaymentMethodResponse.ok) {
              const newPaymentMethod = await createPaymentMethodResponse.json()
              postpaidPaymentMethodId = newPaymentMethod.id
            } else {
              throw new Error("Failed to create postpaid payment method")
            }
          }
        }
      } catch (error) {
        handleError(error, "Failed to setup payment method for new bill")
        return
      }

      // Step 2: Create the invoice (exactly like POS)
      // Get the original invoice type ID - we need to fetch it from the original invoice
      let originalInvoiceTypeId = 1 // Default fallback
      
      // Try to get the invoice type ID from the original invoice
      if (originalInvoice.invoice_type?.id) {
        originalInvoiceTypeId = originalInvoice.invoice_type.id
      } else {
        // If we don't have the nested object, try to get it from the main invoices list
        const mainInvoice = invoices.find(inv => inv.id === selectedInvoice.id)
        if (mainInvoice?.invoice_type?.id) {
          originalInvoiceTypeId = mainInvoice.invoice_type.id
        } else {
          // If we still don't have it, try to fetch the original invoice details
          try {
            if (process.env.NODE_ENV !== 'production') {
              console.log("Fetching original invoice details to get invoice type ID")
            }
            const originalInvoiceResponse = await fetchWithRetry(
              `${API_URL}/sales/invoices/${selectedInvoice.id}/`,
              {
                headers,
                signal: billCreationAbortControllerRef.current.signal
              }
            )
            if (originalInvoiceResponse.ok) {
              const originalInvoiceData = await originalInvoiceResponse.json()
              if (originalInvoiceData.invoice_type?.id) {
                originalInvoiceTypeId = originalInvoiceData.invoice_type.id
                if (process.env.NODE_ENV !== 'production') {
                  console.log("Found invoice type ID from API:", originalInvoiceTypeId)
                }
              }
            }
          } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn("Failed to fetch original invoice details for type ID:", error)
            }
          }
        }
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.log("Using invoice type ID:", originalInvoiceTypeId, "for original invoice type:", originalInvoice.invoice_type_name)
      }
      
      const invoiceData = {
        customer_id: originalInvoice.customer.id,
        warehouse_id: originalInvoice.warehouse.id,
        invoice_type_id: originalInvoiceTypeId, // Use original invoice type instead of hardcoded 1
        payment_method_id: postpaidPaymentMethodId,
        main_invoice_id: originalInvoiceId, // Set the original invoice ID as main_invoice_id
        is_returnable: true,
        notes: `Generated from outstanding invoice #${originalInvoice.composite_id || originalInvoiceId}`,
        global_discount_percent: 0,
        tax_percent: 0,
      }
      
      // Debug: Log the exact data being sent
      if (process.env.NODE_ENV !== 'production') {
        console.log("=== INVOICE CREATION DEBUG ===")
        console.log("Original invoice ID:", originalInvoiceId)
        console.log("Original invoice data:", originalInvoice)
        console.log("Invoice data to send:", JSON.stringify(invoiceData, null, 2))
        console.log("Expected main_invoice_id:", originalInvoiceId)
        console.log("=== END DEBUG ===")
        console.log("Creating invoice with data:", invoiceData)
      }

      const invoiceResponse = await fetchWithRetry(`${API_URL}/sales/invoices/`, {
        method: "POST",
        headers,
        body: JSON.stringify(invoiceData),
        signal: billCreationAbortControllerRef.current.signal
      })

      if (!invoiceResponse.ok) {
        const errorData = await invoiceResponse.json()
        if (process.env.NODE_ENV !== 'production') {
          console.error("Invoice creation error:", errorData)
        }
        throw new Error(errorData.message || errorData.detail || "Failed to create invoice")
      }

      const invoice = await invoiceResponse.json()
      const invoiceId = invoice.id
      if (process.env.NODE_ENV !== 'production') {
        console.log("New invoice created:", invoice)
        console.log("Invoice data sent to API:", invoiceData)
        console.log("Expected main_invoice_id:", originalInvoiceId)
        console.log("Expected composite_id format:", `${originalInvoiceId}_${invoiceId}`)
      }

      // Step 3: Create invoice items in parallel (batched)
      // createdInvoiceItemIds is already declared at function scope for rollback
      
      // Prepare all item data and validate product IDs first
      const itemDataPromises = selectedItems.map(async (item) => {
        const itemTotal = Number(item.total_price) || 0
        
        // Get the product ID - it should be available from the detailed items data
        // item.product could be either an object with id property or the ID directly
        let productId = null
        if (typeof item.product === 'object' && item.product !== null) {
          productId = item.product.id
        } else if (typeof item.product === 'number') {
          productId = item.product
        } else {
          // Try to get from the original invoice items
          const originalInvoice = invoices.find(inv => inv.id === selectedInvoice.id)
          const originalItem = originalInvoice?.items?.find(origItem => 
            origItem.product_name === item.product_name || origItem.id === item.id
          )
          if (originalItem) {
            if (typeof originalItem.product === 'object' && originalItem.product !== null) {
              productId = originalItem.product.id
            } else if (typeof originalItem.product === 'number') {
              productId = originalItem.product
            }
          }
        }
        
        if (!productId) {
          if (process.env.NODE_ENV !== 'production') {
            console.error("No product ID found for item:", item)
            console.error("Item structure:", item)
            console.error("Original invoice items:", invoices.find(inv => inv.id === selectedInvoice.id)?.items)
          }
          throw new Error(`No product ID found for item: ${item.product_name}`)
        }
        
        return {
          invoice: invoiceId,
          product: productId,
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
          discount_percent: Number(item.discount_percent) || 0,
          total_price: itemTotal,
          paid_amount: itemTotal, // Fully paid since it's postpaid
          remaining_amount: 0, // No remaining amount since it's fully paid
          is_paid: true, // Mark as paid
        }
      })
      
      // Wait for all item data to be prepared (validates all product IDs)
      const allItemData = await Promise.all(itemDataPromises)
      
      if (process.env.NODE_ENV !== 'production') {
        console.log("Creating invoice items in parallel:", allItemData.length)
      }
      
      // Create all invoice items in parallel using Promise.allSettled
      const itemCreationPromises = allItemData.map(async (itemData) => {
        const itemResponse = await fetchWithRetry(`${API_URL}/sales/invoice-items/`, {
          method: "POST",
          headers,
          body: JSON.stringify(itemData),
          signal: billCreationAbortControllerRef.current?.signal,
        })

        if (!itemResponse.ok) {
          const errorData = await itemResponse.json()
          if (process.env.NODE_ENV !== 'production') {
            console.error("Invoice item creation error:", errorData)
          }
          throw new Error(errorData.message || errorData.detail || "Failed to create invoice item")
        }

        const createdItem = await itemResponse.json()
        return createdItem
      })
      
      // Wait for all items to be created
      const itemResults = await Promise.allSettled(itemCreationPromises)
      
      // Check for failures
      const failedItems: Array<{ item: typeof allItemData[0], error: Error }> = []
      itemResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          createdInvoiceItemIds.push(result.value.id)
          if (process.env.NODE_ENV !== 'production') {
            console.log("Created invoice item:", result.value)
          }
        } else {
          failedItems.push({
            item: allItemData[index],
            error: result.reason instanceof Error ? result.reason : new Error(String(result.reason))
          })
        }
      })
      
      // If any items failed to create, rollback and throw error with details
      if (failedItems.length > 0) {
        const errorMessages = failedItems.map(f => 
          `Item ${f.item.product}: ${f.error.message}`
        ).join('; ')
        
        // Rollback: Delete created invoice (items were not all created, so no need to delete them)
        if (invoiceId !== undefined) {
          try {
            await rollbackBillCreation(invoiceId, [], undefined, headers, billCreationAbortControllerRef.current?.signal)
          } catch (rollbackError) {
            if (process.env.NODE_ENV !== 'production') {
              console.error("Rollback failed:", rollbackError)
            }
          }
        }
        
        throw new Error(
          `Failed to create ${failedItems.length} invoice item(s): ${errorMessages}. ` +
          `The invoice has been rolled back. Please try again.`
        )
      }

      // Step 4: Create payment record (exactly like POS)
      const paymentData = {
        invoice: invoiceId,
        amount: parseFloat(totalAmount.toFixed(2)),
        payment_date: new Date().toISOString().split('T')[0],
        notes: `Payment for generated bill from invoice #${originalInvoice.composite_id || originalInvoiceId}`,
      }

      const paymentResponse = await fetchWithRetry(`${API_URL}/sales/payments/`, {
        method: "POST",
        headers,
        body: JSON.stringify(paymentData),
        signal: billCreationAbortControllerRef.current?.signal,
      })

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json()
        
        // Rollback: Delete created invoice items and invoice (payment not created yet)
        if (invoiceId !== undefined) {
          try {
            await rollbackBillCreation(
              invoiceId,
              createdInvoiceItemIds,
              undefined,
              headers,
              billCreationAbortControllerRef.current?.signal
            )
          } catch (rollbackError) {
            if (process.env.NODE_ENV !== 'production') {
              console.error("Rollback failed:", rollbackError)
            }
          }
        }
        
        throw new Error(
          `Failed to create payment: ${errorData.message || errorData.detail || "Unknown error"}. ` +
          `The bill has been rolled back. Please try again.`
        )
      }

      const createdPayment = await paymentResponse.json()
      createdPaymentId = createdPayment.id
      
      if (process.env.NODE_ENV !== 'production') {
        console.log("Payment record created successfully:", createdPayment)
      }

      // Step 5: Update original invoice items to mark them as paid (in parallel)
      // Filter items that have IDs (required for updates)
      const itemsToUpdate = selectedItems.filter(item => item.id)
      
      if (itemsToUpdate.length === 0) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn("No items with IDs found to update in original invoice")
        }
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`Updating ${itemsToUpdate.length} original invoice items in parallel...`)
        }
        
        // Prepare all update requests
        const updatePromises = itemsToUpdate.map(async (item) => {
          const updateData = {
            paid_amount: Number(item.total_price) || 0,
            remaining_amount: 0,
            is_paid: true,
          }
          
          const updateItemResponse = await fetchWithRetry(
            `${API_URL}/sales/invoice-items/${item.id}/`,
            {
              method: "PATCH",
              headers,
              body: JSON.stringify(updateData),
              signal: billCreationAbortControllerRef.current?.signal,
            }
          )

          if (!updateItemResponse.ok) {
            const errorData = await updateItemResponse.json()
            throw new Error(
              `Failed to update item ${item.id}: ${errorData.message || errorData.detail || "Unknown error"}`
            )
          }

          return { itemId: item.id, success: true }
        })
        
        // Execute all updates in parallel
        const updateResults = await Promise.allSettled(updatePromises)
        
        // Check for failures
        const failedUpdates: Array<{ itemId: number | undefined, error: Error }> = []
        updateResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`Successfully updated item ${itemsToUpdate[index].id}`)
            }
          } else {
            failedUpdates.push({
              itemId: itemsToUpdate[index].id,
              error: result.reason instanceof Error ? result.reason : new Error(String(result.reason))
            })
          }
        })
        
        // Log warnings for failed updates (non-blocking, as items are already in child bill)
        if (failedUpdates.length > 0) {
          const errorMessages = failedUpdates.map(f => 
            `Item ${f.itemId}: ${f.error.message}`
          ).join('; ')
          
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`Failed to update ${failedUpdates.length} item(s) in original invoice:`, errorMessages)
          }
          
          // Show warning toast but don't fail the entire operation
          toast({
            title: "Warning",
            description: `Failed to update ${failedUpdates.length} item(s) in original invoice. The child bill was created successfully, but you may need to manually update the original invoice items.`,
            variant: "default",
            duration: 8000,
          })
        }
      }

      // Step 6: Update original invoice totals
      const originalInvoiceItems = selectedInvoice.items || []
      const remainingItems = originalInvoiceItems.filter(item => !item.selected)
      const newTotalAmount = remainingItems.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0)
      const newTotalPaid = remainingItems.reduce((sum, item) => sum + (Number(item.paid_amount) || 0), 0)
      const newRemainingAmount = newTotalAmount - newTotalPaid
      const isInvoiceFullyPaid = remainingItems.length === 0

      // Generate composed ID after we have the new bill ID
      const composedId = generateComposedId(originalInvoiceId, invoiceId)

      const updateOriginalInvoiceData: {
        total_amount: number
        total_paid: number
        remaining_amount: number
        notes: string
        is_fully_paid?: boolean
        status?: string
      } = {
        total_amount: newTotalAmount,
        total_paid: newTotalPaid,
        remaining_amount: newRemainingAmount,
        notes: `${selectedInvoice.notes || ''}\n\nItems removed and child bill generated: ${invoiceId} (composite_id: ${composedId}, main_invoice: ${originalInvoiceId})`,
      }

      if (isInvoiceFullyPaid) {
        updateOriginalInvoiceData.is_fully_paid = true
        updateOriginalInvoiceData.status = "paid"
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log("Updating original invoice with data:", updateOriginalInvoiceData)
      }
      const updateOriginalInvoiceResponse = await fetchWithRetry(
        `${API_URL}/sales/invoices/${selectedInvoice.id}/`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify(updateOriginalInvoiceData),
          signal: billCreationAbortControllerRef.current.signal
        }
      )

      if (!updateOriginalInvoiceResponse.ok) {
        const errorData = await updateOriginalInvoiceResponse.json()
        if (process.env.NODE_ENV !== 'production') {
          console.error("Failed to update original invoice:", errorData)
        }
        
        // Rollback: Delete created payment, invoice items, and invoice
        // The original invoice update is critical for data consistency
        if (invoiceId !== undefined) {
          try {
            await rollbackBillCreation(
              invoiceId,
              createdInvoiceItemIds,
              createdPaymentId,
              headers,
              billCreationAbortControllerRef.current?.signal
            )
          } catch (rollbackError) {
            if (process.env.NODE_ENV !== 'production') {
              console.error("Rollback failed:", rollbackError)
            }
          }
        }
        
        throw new Error(
          `Failed to update original invoice: ${errorData.message || errorData.detail || "Unknown error"}. ` +
          `The bill has been rolled back to maintain data consistency. Please try again.`
        )
      }

      const updatedInvoice = await updateOriginalInvoiceResponse.json()
      if (process.env.NODE_ENV !== 'production') {
        console.log("Updated original invoice:", updatedInvoice)
      }

      // Success messages

      const successMessage = isInvoiceFullyPaid 
        ? `Child bill #${invoiceId} (composite_id: ${composedId}) created successfully! Main invoice #${originalInvoice.composite_id || originalInvoiceId} is now fully paid and will no longer appear in outstanding payments.`
        : `Child bill #${invoiceId} (composite_id: ${composedId}) created successfully! Main invoice #${originalInvoice.composite_id || originalInvoiceId} updated with ${remainingItems.length} remaining items.`

      toast({
        title: "New Bill Generated Successfully",
        description: successMessage,
        variant: "default",
      })

      setSelectedItems([])
      setReopenMainInvoiceAfterReceipt(!isInvoiceFullyPaid)

      await fetchInvoices()

      // Refresh main invoice data in background so it stays available after receipt closes
      if (!isInvoiceFullyPaid) {
        await handleViewInvoice(
          { ...(originalInvoice as Invoice), id: originalInvoiceId },
          { openDialog: false },
        )
      } else {
        setSelectedInvoice(null)
      }

      // Fetch child bill summary and show receipt (same as POS complete sale)
      try {
        const verifyResponse = await fetchWithRetry(
          `${API_URL}/sales/invoices/${invoiceId}/summary/`,
          {
            headers,
            signal: billCreationAbortControllerRef.current.signal,
          },
        )
        if (verifyResponse.ok) {
          const childSummary = await verifyResponse.json()
          const { payload, currencyLabel } = buildReceiptPayloadForDisplay(
            childSummary,
            originalInvoice.warehouse,
            warehouses,
          )
          setReceiptPayload(payload)
          setReceiptCurrencyLabel(currencyLabel)
          setActiveDialog("receipt")
        } else {
          toast({
            title: "Child Bill Created",
            description: "Bill was created but the receipt could not be loaded. View it from Invoices.",
            variant: "default",
          })
          if (!isInvoiceFullyPaid) {
            setActiveDialog("view")
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Error loading child bill receipt:", error)
        }
        toast({
          title: "Child Bill Created",
          description: "Bill was created but the receipt could not be loaded. View it from Invoices.",
          variant: "default",
        })
        if (!isInvoiceFullyPaid) {
          setActiveDialog("view")
        }
      }

    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating new bill:", error)
      }
      
      let errorMessage = "Failed to create new bill. Please try again."
      let needsManualReconciliation = false
      
      if (error instanceof Error) {
        if (error.message.includes("composite_id")) {
          errorMessage = "Backend error: Invoice creation failed due to composite_id constraint. Please contact support."
        } else if (error.message.includes("Duplicate entry")) {
          errorMessage = "Backend error: Duplicate invoice entry. Please try again."
        } else if (error.message.includes("rolled back")) {
          // Rollback was already attempted
          errorMessage = error.message
        } else if (error.message.includes("No product ID found") || error.message.includes("Failed to setup payment method")) {
          // These errors occur before invoice creation, so no rollback needed
          errorMessage = error.message
        } else {
          // For other errors that might occur after invoice creation, attempt rollback
          // Check if we have invoiceId (means invoice was created)
          if (invoiceId !== undefined && headers) {
            try {
              await rollbackBillCreation(
                invoiceId,
                createdInvoiceItemIds,
                createdPaymentId,
                headers,
                billCreationAbortControllerRef.current?.signal
              )
              errorMessage = `${error.message} The bill has been rolled back. Please try again.`
            } catch (rollbackError) {
              // Rollback failed - need manual reconciliation
              needsManualReconciliation = true
              errorMessage = `${error.message} Rollback failed. Invoice ID: ${invoiceId}. Please contact support for manual reconciliation.`
              if (process.env.NODE_ENV !== 'production') {
                console.error("Rollback failed:", rollbackError)
              }
            }
          } else {
            errorMessage = error.message
          }
        }
      }
      
      // Create a new Error with the constructed message to ensure handleError uses it
      const customError = new Error(errorMessage)
      handleError(
        customError,
        errorMessage,
        {
          title: needsManualReconciliation ? "Error - Manual Reconciliation Required" : "Error",
          duration: needsManualReconciliation ? 10000 : 5000,
        }
      )
    } finally {
      setIsCreatingBill(false)
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink asChild>
                    <Link href="/admin">Admin</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Outstanding Payments</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <h2 className="text-xl font-semibold mb-4">Outstanding Payment Management</h2>
            <p className="mb-6">View and manage invoices that are not fully paid, including completely unpaid invoices and those with partial payments.</p>


            {/* Filters Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Warehouse Filter */}
              <div className="space-y-2">
                  <Label>Warehouse</Label>
                  <Select
                    value={selectedWarehouse?.toString() || "all"}
                    onValueChange={(value) => setSelectedWarehouse(value === "all" ? null : Number(value))}
                  >
                  <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder="All Warehouses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Warehouses</SelectItem>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                          {warehouse.name_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              {/* Date Range Filter */}
              <div className="space-y-2">
                  <Label>Date Range</Label>
                <div className="h-10">
                    <DatePickerWithRange
                      date={dateRange ?? { from: undefined, to: undefined }}
                      onDateChange={(range) => setDateRange(range ?? null)}
                    />
                  </div>
                </div>

              {/* Invoice Search Filter */}
              <div className="space-y-2">
                  <Label>Invoice/Composite ID</Label>
                    <Input
                  className="w-full h-10"
                      placeholder="Search by invoice ID (e.g., 121 or 121_223)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleSearch()
                        }
                      }}
                    />
              </div>

              {/* Customer Filter */}
              <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select
                    value={selectedCustomerId?.toString() || "all"}
                    onValueChange={(value) =>
                      setSelectedCustomerId(value === "all" ? null : Number(value))
                    }
                    disabled={isLoadingCustomers}
                  >
                    <SelectTrigger className="w-full h-10">
                      <SelectValue
                        placeholder={isLoadingCustomers ? "Loading customers..." : "All Customers"}
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="all">All Customers</SelectItem>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {customer.institution_name || customer.name_en || `Customer #${customer.id}`}
                          {customer.contact_person ? ` (${customer.contact_person})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mb-6">
                      <Button 
                onClick={handleSearch}
                disabled={isLoading}
                      >
                        <Search className="h-4 w-4 mr-2" />
                {isLoading ? "Loading..." : "Search"}
                      </Button>
              <Button variant="outline" onClick={handleResetFilters} disabled={isLoading}>
                        Reset
                      </Button>
                      <Button variant="secondary" onClick={() => {
                        setSelectedWarehouse(null)
                        setDateRange(null)
                        setSearchQuery("")
                        setSelectedCustomerId(null)
                        fetchInvoices()
              }} disabled={isLoading}>
                {isLoading ? "Loading..." : "Load Outstanding"}
                      </Button>
            </div>

            {/* Selected Total Display */}
            {selectedTotal > 0 && (
              <div className="mb-4 p-4 bg-primary/10 rounded-md">
                <p className="text-lg font-semibold">
                  Selected Outstanding Total: {selectedTotalDisplay}
                </p>
              </div>
            )}

            {/* Invoices Table */}
            {!hasSearched ? (
              <div className="text-center text-muted-foreground py-12">
                <p>Click "Search" to view all outstanding invoices (unpaid and partially paid) or use filters to narrow down results.</p>
                <p className="text-sm mt-2">You can filter by invoice ID (e.g., &quot;121&quot; or &quot;121_223&quot;), select a customer from the list, or use date/warehouse filters.</p>
              </div>
            ) : (
              <div className="border rounded-md">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-sm border-b">
                        <th className="text-left font-medium p-2">
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              setInvoices(invoices.map(invoice => ({
                                ...invoice,
                                selected: e.target.checked
                              })))
                            }}
                            checked={invoices.length > 0 && invoices.every(invoice => invoice.selected)}
                          />
                        </th>
                        <th className="text-left font-medium p-2">Invoice ID</th>
                        <th className="text-left font-medium p-2">Customer</th>
                        <th className="text-left font-medium p-2">Warehouse</th>
                        <th className="text-left font-medium p-2">Date</th>
                        <th className="text-right font-medium p-2">Total Amount</th>
                        <th className="text-right font-medium p-2">Paid Amount</th>
                        <th className="text-right font-medium p-2">Outstanding</th>
                        <th className="text-right font-medium p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center">
                            Loading invoices...
                          </td>
                        </tr>
                      ) : invoices.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center">
                            <div className="text-muted-foreground">
                              <p>No outstanding invoices found</p>
                              <p className="text-sm mt-1">All invoices are fully paid or no invoices match your search criteria</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        invoices.map((invoice) => (
                          <tr key={invoice.id} className="border-b last:border-0">
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={invoice.selected || false}
                                onChange={() => handleInvoiceSelect(invoice.id)}
                              />
                            </td>
                            <td className="p-2">{formatInvoiceId(invoice)}</td>
                            <td className="p-2">{invoice.customer_name || 'No Customer'}</td>
                            <td className="p-2">{invoice.warehouse_name || 'No Warehouse'}</td>
                            <td className="p-2">{invoice.created_at ? format(new Date(invoice.created_at), "PPP") : 'No Date'}</td>
                            <td className="p-2 text-right">
                              {formatInvoiceUsdAmount(invoice.total_amount || 0, invoice, warehouses)}
                            </td>
                            <td className="p-2 text-right">
                              {formatInvoiceUsdAmount(invoice.total_paid || 0, invoice, warehouses)}
                            </td>
                            <td className="p-2 text-right font-semibold text-red-600">
                              {formatInvoiceUsdAmount(invoice.remaining_amount || 0, invoice, warehouses)}
                            </td>
                            <td className="p-2 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewInvoice(invoice)}
                                disabled={isViewingInvoice}
                              >
                                {isViewingInvoice ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Loading...
                                  </>
                                ) : (
                                  <>
                                    <FileText className="h-4 w-4 mr-2" />
                                    View
                                  </>
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>

      {/* View Invoice Dialog */}
      <Dialog open={activeDialog === 'view'} onOpenChange={(open) => setActiveDialog(open ? 'view' : null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Outstanding Invoice Details</DialogTitle>
            <DialogDescription>
              Invoice #{selectedInvoice?.composite_id || selectedInvoice?.id} - {selectedInvoice?.customer_name || 'No Customer'}
              {selectedInvoice?.composite_id?.includes('_') && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Child Invoice
                </span>
              )}
              {showOnlyUnpaid && (
                <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                  Showing Unpaid Items Only
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Customer Information</h3>
                  <p>{selectedInvoice.customer_name || 'No Customer'}</p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.customer_contact || 'No Contact Person'}</p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Invoice Information</h3>
                  <p>Date: {selectedInvoice.created_at ? format(new Date(selectedInvoice.created_at), "PPP") : 'No Date'}</p>
                  <p>Warehouse: {selectedInvoice.warehouse_name || 'No Warehouse'}</p>
                  <p>Type: {selectedInvoice.invoice_type_name || 'No Type'}</p>
                  <p>Payment Method: {selectedInvoice.payment_method_name || 'No Payment Method'}</p>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-md">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-lg font-semibold">
                    {formatInvoiceUsdAmount(selectedInvoice.total_amount || 0, selectedInvoice, warehouses)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid Amount</p>
                  <p className="text-lg font-semibold text-green-600">
                    {formatInvoiceUsdAmount(selectedInvoice.total_paid || 0, selectedInvoice, warehouses)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-lg font-semibold text-red-600">
                    {formatInvoiceUsdAmount(selectedInvoice.remaining_amount || 0, selectedInvoice, warehouses)}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Invoice Items */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                  <h3 className="font-medium">Items</h3>
                    {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                      <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                        <span>Total: {selectedInvoice.items.length}</span>
                        <span className="text-green-600">
                          Paid: {selectedInvoice.items.filter(item => item.is_paid || Number(item.paid_amount) >= Number(item.total_price)).length}
                        </span>
                        <span className="text-orange-600">
                          Unpaid: {selectedInvoice.items.filter(item => !item.is_paid && Number(item.paid_amount) < Number(item.total_price)).length}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOnlyUnpaid(!showOnlyUnpaid)}
                    >
                      {showOnlyUnpaid ? "Show All" : "Show Unpaid Only"}
                    </Button>
                  <Button
                    onClick={handleGenerateNewBill}
                      disabled={!selectedInvoice.items?.some(item => item.selected && !item.is_paid) || isCreatingBill}
                  >
                    {isCreatingBill ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Generate Child Bill
                      </>
                    )}
                  </Button>
                  </div>
                </div>
                <div className="border rounded-md">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-sm border-b">
                        <th className="text-left font-medium p-2">
                          <Checkbox
                            checked={selectedInvoice.items && selectedInvoice.items.length > 0 && 
                              selectedInvoice.items
                                .filter(item => !item.is_paid)
                                .filter(item => !showOnlyUnpaid || !(item.is_paid || Number(item.paid_amount) >= Number(item.total_price)))
                                .every(item => item.selected)}
                            onChange={(e) => {
                              if (selectedInvoice.items) {
                                const updatedItems = selectedInvoice.items.map(item => {
                                  const isPaid = item.is_paid || Number(item.paid_amount) >= Number(item.total_price)
                                  const shouldUpdate = !isPaid && (!showOnlyUnpaid || !isPaid)
                                  return {
                                  ...item,
                                    selected: shouldUpdate ? e.target.checked : item.selected
                                  }
                                })
                                setSelectedInvoice({ ...selectedInvoice, items: updatedItems })
                              }
                            }}
                          />
                        </th>
                                                <th className="text-left font-medium p-2">Product</th>
                        <th className="text-right font-medium p-2">Quantity</th>
                        <th className="text-right font-medium p-2">Unit Price</th>
                        <th className="text-right font-medium p-2">Discount</th>
                        <th className="text-right font-medium p-2">Tax</th>
                        <th className="text-right font-medium p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingItems ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-muted-foreground">
                            <div className="py-4">
                              <p className="text-sm">Loading invoice items...</p>
                            </div>
                          </td>
                        </tr>
                      ) : selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                        selectedInvoice.items
                          .filter(item => !showOnlyUnpaid || !(item.is_paid || Number(item.paid_amount) >= Number(item.total_price)))
                          .map((item, index) => {
                          const isPaid = item.is_paid || Number(item.paid_amount) >= Number(item.total_price)
                          return (
                            <tr key={index} className={`border-b last:border-0 ${isPaid ? 'bg-green-50' : ''}`}>
                            <td className="p-2">
                              <Checkbox
                                checked={item.selected || false}
                                onChange={() => handleItemSelect(selectedInvoice.items.indexOf(item))}
                                  disabled={isPaid}
                              />
                            </td>
                            <td className="p-2">
                              <div>
                                  <p className={`font-medium ${isPaid ? 'text-green-700' : ''}`}>
                                    {item.product_name || 'No Title'}
                                    {isPaid && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">PAID</span>}
                                  </p>
                                  <p className={`text-sm ${isPaid ? 'text-green-600' : 'text-muted-foreground'}`}>
                                    {(typeof item.product === 'object' && item.product !== null ? (item.product.name_ar || item.product.title_ar) : null) || 'No Arabic Title'}
                                  </p>
                              </div>
                            </td>
                              <td className={`p-2 text-right ${isPaid ? 'text-green-700' : ''}`}>{Number(item.quantity) || 0}</td>
                              <td className={`p-2 text-right ${isPaid ? 'text-green-700' : ''}`}>
                                {formatLineUsdAmount(Number(item.unit_price) || 0, item, selectedInvoice, warehouses)}
                              </td>
                              <td className={`p-2 text-right ${isPaid ? 'text-green-700' : ''}`}>{Number(item.discount_percent) || 0}%</td>
                              <td className={`p-2 text-right ${isPaid ? 'text-green-700' : ''}`}>{Number(item.tax_percent) || 0}%</td>
                              <td className={`p-2 text-right ${isPaid ? 'text-green-700 font-semibold' : ''}`}>
                                {formatLineUsdAmount(Number(item.total_price) || 0, item, selectedInvoice, warehouses)}
                                {isPaid && <span className="ml-1 text-xs text-green-600">✓</span>}
                              </td>
                          </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-muted-foreground">
                            <div className="py-4">
                              <p className="text-sm">No items found for this invoice</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                This invoice might not have any line items
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Generate New Bill Dialog */}
      <Dialog open={activeDialog === 'generate'} onOpenChange={(open) => setActiveDialog(open ? 'generate' : null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Child Bill</DialogTitle>
            <DialogDescription>
              Review selected items and generate a child bill from Main Invoice #{selectedInvoice?.composite_id || selectedInvoice?.id}
              {selectedInvoice?.composite_id?.includes('_') && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Child Invoice
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedItems.length > 0 && (
            <div className="space-y-6">
              {/* New Bill Preview */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Main Invoice</h3>
                  <p className="text-sm text-muted-foreground">#{selectedInvoice?.composite_id || selectedInvoice?.id}</p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice?.customer_name}</p>
                  <p className="text-sm text-muted-foreground">Type: {selectedInvoice?.invoice_type_name || 'Unknown'}</p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Child Bill</h3>
                  <p className="text-sm text-muted-foreground">Composite ID: Will be generated after bill creation</p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice?.customer_name}</p>
                  <p className="text-sm text-muted-foreground">Type: <span className="text-green-600 font-medium">paid</span></p>
                </div>
              </div>

              <Separator />

              {/* Bill Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-md">
                <div>
                  <p className="text-sm text-muted-foreground">Child Bill ID</p>
                  <p className="text-lg font-semibold">Will be assigned</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Main Invoice</p>
                  <p className="text-lg font-semibold">#{selectedInvoice?.composite_id || selectedInvoice?.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-lg font-semibold text-green-600">
                    {selectedInvoice
                      ? formatInvoiceUsdAmount(
                          selectedItems.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0),
                          selectedInvoice,
                          warehouses,
                        )
                      : "0.000 $"}
                  </p>
                </div>
              </div>

              {/* Selected Items */}
              <div>
                <h3 className="font-medium mb-4">Selected Items ({selectedItems.length})</h3>
                <div className="border rounded-md">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-sm border-b">
                        <th className="text-left font-medium p-2">Product</th>
                        <th className="text-right font-medium p-2">Quantity</th>
                        <th className="text-right font-medium p-2">Unit Price</th>
                        <th className="text-right font-medium p-2">Discount</th>
                        <th className="text-right font-medium p-2">Tax</th>
                        <th className="text-right font-medium p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item, index) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="p-2">
                            <div>
                              <p className="font-medium">{item.product_name || 'No Title'}</p>
                              <p className="text-sm text-muted-foreground">{(typeof item.product === 'object' && item.product !== null ? (item.product.name_ar || item.product.title_ar) : null) || 'No Arabic Title'}</p>
                            </div>
                          </td>
                          <td className="p-2 text-right">{Number(item.quantity) || 0}</td>
                          <td className="p-2 text-right">
                            {selectedInvoice
                              ? formatLineUsdAmount(Number(item.unit_price) || 0, item, selectedInvoice, warehouses)
                              : `${(Number(item.unit_price) || 0).toFixed(3)} $`}
                          </td>
                          <td className="text-right">{Number(item.discount_percent) || 0}%</td>
                          <td className="p-2 text-right">{Number(item.tax_percent) || 0}%</td>
                          <td className="p-2 text-right">
                            {selectedInvoice
                              ? formatLineUsdAmount(Number(item.total_price) || 0, item, selectedInvoice, warehouses)
                              : `${(Number(item.total_price) || 0).toFixed(3)} $`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t">
                        <td colSpan={4} className="p-2 text-right font-medium">
                          Total Amount:
                        </td>
                        <td className="p-2 text-right font-medium">
                          {selectedInvoice
                            ? formatInvoiceUsdAmount(
                                selectedItems.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0),
                                selectedInvoice,
                                warehouses,
                              )
                            : "0.000 $"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setActiveDialog(null)} disabled={isCreatingBill}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmGenerateBill} disabled={isCreatingBill}>
                  <Plus className="h-4 w-4 mr-2" />
                  Review & Create Child Bill
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={activeDialog === 'confirm'} onOpenChange={(open) => setActiveDialog(open ? 'confirm' : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Child Bill Creation</DialogTitle>
            <DialogDescription>
              Are you sure you want to create a child bill with {selectedItems.length} selected items?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm font-medium">Summary:</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Child bill will be created with "postpaid" payment method</li>
                <li>• Child bill ID will be assigned automatically by the system</li>
                <li>• Composite ID will be: main_invoice_id_child_bill_id</li>
                <li>• Main invoice ID will be set to the original invoice ID</li>
                <li>• Selected items will be marked as paid in the main invoice</li>
                <li>• Main invoice amounts will be recalculated</li>
                <li>• If all items are selected, main invoice will be marked as fully paid</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setActiveDialog(null)} disabled={isCreatingBill}>
                Cancel
              </Button>
              <Button onClick={handleCreateNewBill} disabled={isCreatingBill}>
                {isCreatingBill ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Child Bill
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Child Bill Receipt Dialog */}
      <Dialog
        open={activeDialog === "receipt"}
        onOpenChange={(open) => {
          if (!open) handleCloseReceipt()
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-full max-w-md flex-col gap-0 overflow-hidden sm:max-w-md">
          <DialogHeader className="shrink-0 space-y-1 pb-2">
            <DialogTitle>Child Bill Receipt</DialogTitle>
            <DialogDescription>View, print, or download the new child bill.</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            {receiptPayload ? (
              <ReceiptContent
                receiptData={receiptPayload}
                currencyLabel={receiptCurrencyLabel}
                getDisplayPrice={() => null}
                onClose={handleCloseReceipt}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}

