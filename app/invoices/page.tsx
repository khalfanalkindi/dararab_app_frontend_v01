"use client"

import Link from "next/link"
import { useState, useEffect, useRef, useMemo } from "react"
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
import { FileText, Search, Trash2, Receipt, Loader2 } from "lucide-react"
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
import { API_URL } from "@/lib/config"

interface Invoice {
  id: number
  composite_id?: string // Add composite_id field
  invoice_number: string
  customer: {
    id: number
    institution_name: string
    contact_person: string
  }
  warehouse: {
    id: number
    name_en: string
  }
  invoice_type: {
    id: number
    display_name_en: string
  }
  payment_method: {
    id: number
    display_name_en: string
  }
  created_at: string
  total_amount: number
  global_discount_percent?: string
  tax_percent?: string
  total_paid?: number
  remaining_amount?: number
  status: string
  items: InvoiceItem[]
  notes?: string
  selected?: boolean
}

interface InvoiceItem {
  id: number
  product: {
    id: number
    title_en: string
    title_ar: string
  }
  quantity: number
  unit_price: number
  discount_percent: number
  total_price: number
}

interface Warehouse {
  id: number
  name_en: string
  name_ar: string
}

// API Response Types
interface InvoiceSummaryItemResponse {
  id: number
  product_name: string
  quantity: number
  unit_price: string | number
  discount_percent: string | number
  total_price: string | number
}

interface InvoiceSummaryResponse {
  id: number
  composite_id?: string
  customer_name: string
  customer_contact: string
  warehouse_name: string
  invoice_type_name: string
  payment_method_name: string
  created_at: string
  total_amount: string | number
  global_discount_percent?: string
  tax_percent?: string
  total_paid: string | number
  remaining_amount: string | number
  items?: InvoiceSummaryItemResponse[]
  notes?: string
  status?: string // If backend provides status, use it
}

interface InvoiceItemsResponse {
  results?: InvoiceSummaryItemResponse[]
  items?: InvoiceSummaryItemResponse[]
  // If response is directly an array
  [index: number]: InvoiceSummaryItemResponse
}

// Helper function to calculate invoice status
const calculateInvoiceStatus = (
  totalPaid: number,
  totalAmount: number,
  globalDiscountPercent: string | number = 0,
  taxPercent: string | number = 0
): string => {
  // Calculate final total: (total_amount - discount) * (1 + tax)
  const discount = parseFloat(String(globalDiscountPercent)) || 0
  const tax = parseFloat(String(taxPercent)) || 0
  const discountedAmount = totalAmount * (1 - discount / 100)
  const finalTotal = discountedAmount * (1 + tax / 100)
  
  // Use tolerance for floating point comparison
  if (Math.abs(totalPaid - finalTotal) < 0.001) {
    return 'Paid'
  } else if (totalPaid > 0) {
    return 'Partial'
  }
  return 'Unpaid'
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [hasSearched, setHasSearched] = useState(false)

  // Individual operation loading states
  const [isViewingInvoice, setIsViewingInvoice] = useState(false)
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false)

  // Consolidated dialog state - only one dialog can be open at a time
  type DialogType = 'view' | 'delete' | null
  const [activeDialog, setActiveDialog] = useState<DialogType>(null)

  // AbortController refs for request cancellation
  const warehousesAbortControllerRef = useRef<AbortController | null>(null)
  const invoicesAbortControllerRef = useRef<AbortController | null>(null)
  const invoiceDetailsAbortControllerRef = useRef<AbortController | null>(null)
  const deleteAbortControllerRef = useRef<AbortController | null>(null)

  // Memoize headers to prevent recreation on every render
  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }), [])

  // Utility function for retry logic with exponential backoff
  const fetchWithRetry = async (
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
  }

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
    
    // Cleanup: abort pending requests on unmount
    return () => {
      warehousesAbortControllerRef.current?.abort()
      invoicesAbortControllerRef.current?.abort()
      invoiceDetailsAbortControllerRef.current?.abort()
      deleteAbortControllerRef.current?.abort()
    }
  }, [])

  // Debounce search query to reduce API calls if auto-search is enabled
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300) // 300ms delay

    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchWarehouses = async () => {
    // Abort previous request if still pending
    warehousesAbortControllerRef.current?.abort()
    warehousesAbortControllerRef.current = new AbortController()
    
    try {
      const res = await fetchWithRetry(
        `${API_URL}/inventory/warehouses/`,
        { headers, signal: warehousesAbortControllerRef.current.signal }
      )
      const data = await res.json()
      setWarehouses(Array.isArray(data) ? data : data.results || [])
    } catch (error) {
      handleError(error, "Failed to fetch warehouses")
    }
  }

  const fetchInvoices = async (searchOverride?: string) => {
    // Abort previous request if still pending
    invoicesAbortControllerRef.current?.abort()
    invoicesAbortControllerRef.current = new AbortController()
    
    setIsLoading(true)
    try {
      let url = `${API_URL}/sales/invoices/`
      const params = new URLSearchParams()

      if (selectedWarehouse) {
        params.append("warehouse_id", selectedWarehouse.toString())
      }
      if (dateRange?.from) {
        params.append("start_date", format(dateRange.from, "yyyy-MM-dd"))
      }
      if (dateRange?.to) {
        params.append("end_date", format(dateRange.to, "yyyy-MM-dd"))
      }
      // Use searchOverride if provided (from button click), otherwise use debounced value (for auto-search)
      const searchValue = searchOverride !== undefined ? searchOverride : debouncedSearchQuery
      if (searchValue) {
        params.append("search", searchValue)
      }
      params.append("page_size", "1000")
      params.append("ordering", "-created_at") // Order by created_at in descending order

      const queryString = params.toString()
      if (queryString) {
        url += `?${queryString}`
      }

      const res = await fetchWithRetry(url, {
        headers,
        signal: invoicesAbortControllerRef.current.signal
      })
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const data = await res.json()
      const invoicesData = Array.isArray(data)
        ? data
        : Array.isArray(data.results)
        ? data.results
        : []

      setInvoices(invoicesData)
      setHasSearched(true)
    } catch (error) {
      handleError(error, "Failed to fetch invoices")
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewInvoice = async (invoice: Invoice) => {
    // Abort previous request if still pending
    invoiceDetailsAbortControllerRef.current?.abort()
    invoiceDetailsAbortControllerRef.current = new AbortController()
    
    setIsViewingInvoice(true)
    try {
      const res = await fetchWithRetry(
        `${API_URL}/sales/invoices/${invoice.id}/summary/`,
        { headers, signal: invoiceDetailsAbortControllerRef.current.signal }
      )
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const data: InvoiceSummaryResponse = await res.json()
      if (process.env.NODE_ENV !== 'production') {
        console.log('Invoice API Response:', data)
      }
      
      // Convert string/number fields to numbers for calculations
      const totalAmount = typeof data.total_amount === 'string' ? parseFloat(data.total_amount) : data.total_amount
      const totalPaid = typeof data.total_paid === 'string' ? parseFloat(data.total_paid) : data.total_paid
      const remainingAmount = typeof data.remaining_amount === 'string' ? parseFloat(data.remaining_amount) : data.remaining_amount
      
      // Use status from API if available, otherwise calculate it
      const status = data.status || calculateInvoiceStatus(
        totalPaid,
        totalAmount,
        data.global_discount_percent,
        data.tax_percent
      )
      
      // Process the data according to the InvoiceSummarySerializer structure
      const processedData: Invoice = {
        id: data.id,
        composite_id: data.composite_id || invoice.composite_id,
        invoice_number: invoice.invoice_number,
        customer: {
          id: invoice.customer?.id || 0,
          institution_name: data.customer_name || 'No Customer',
          contact_person: data.customer_contact || 'No Contact Person',
        },
        warehouse: {
          id: invoice.warehouse?.id || 0,
          name_en: data.warehouse_name || 'No Warehouse',
        },
        invoice_type: {
          id: invoice.invoice_type?.id || 0,
          display_name_en: data.invoice_type_name || 'No Type',
        },
        payment_method: {
          id: invoice.payment_method?.id || 0,
          display_name_en: data.payment_method_name || 'No Payment Method',
        },
        created_at: data.created_at,
        total_amount: totalAmount,
        global_discount_percent: data.global_discount_percent || "0.00",
        tax_percent: data.tax_percent || "0.00",
        total_paid: totalPaid,
        remaining_amount: remainingAmount,
        status: status,
        items: data.items?.map((item: InvoiceSummaryItemResponse) => ({
          id: item.id || 0,
          product: {
            id: 0, // Not provided in the API response
            title_en: item.product_name || 'No Title',
            title_ar: item.product_name || 'No Arabic Title',
          },
          quantity: typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity,
          unit_price: typeof item.unit_price === 'string' ? parseFloat(item.unit_price) : item.unit_price,
          discount_percent: typeof item.discount_percent === 'string' ? parseFloat(item.discount_percent) : (item.discount_percent || 0),
          total_price: typeof item.total_price === 'string' ? parseFloat(item.total_price) : item.total_price
        })) || [],
        notes: data.notes || ''
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('Processed invoice data:', processedData)
      }
      
      setSelectedInvoice(processedData)
      setActiveDialog('view')
    } catch (error) {
      handleError(error, "Failed to fetch invoice details")
    } finally {
      setIsViewingInvoice(false)
    }
  }

  const handleResetFilters = () => {
    setSelectedWarehouse(null)
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

  // Calculate selected total using useMemo for efficiency
  const selectedTotal = useMemo(() => {
    return invoices
      .filter(invoice => invoice.selected)
      .reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0)
  }, [invoices])

  // Calculate invoice totals for view dialog
  const invoiceTotals = useMemo(() => {
    if (!selectedInvoice) {
      return {
        subtotal: 0,
        discountAmount: 0,
        discountedSubtotal: 0,
        taxAmount: 0,
        total: 0,
        totalPaid: 0,
        amountDue: 0,
      }
    }

    const subtotal = selectedInvoice.total_amount || 0
    const globalDiscountPercent = parseFloat(selectedInvoice.global_discount_percent || "0")
    const taxPercent = parseFloat(selectedInvoice.tax_percent || "0")
    const totalPaid = selectedInvoice.total_paid || 0

    // Calculate discount amount
    const discountAmount = subtotal * (globalDiscountPercent / 100)

    // Calculate discounted subtotal (after discount, before tax)
    const discountedSubtotal = subtotal - discountAmount

    // Calculate tax amount (on discounted subtotal)
    const taxAmount = discountedSubtotal * (taxPercent / 100)

    // Calculate final total (discounted subtotal + tax)
    const total = discountedSubtotal + taxAmount

    // Amount due is the difference between total and paid
    const amountDue = Math.max(0, total - totalPaid)

    return {
      subtotal,
      discountAmount,
      discountedSubtotal,
      taxAmount,
      total,
      totalPaid,
      amountDue,
    }
  }, [selectedInvoice])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Use current searchQuery value immediately when user clicks search button
    // This bypasses debounce for manual searches
    fetchInvoices(searchQuery)
  }

  const fetchInvoiceItems = async (invoiceId: number, signal?: AbortSignal): Promise<InvoiceSummaryItemResponse[]> => {
    try {
      const res = await fetchWithRetry(
        `${API_URL}/sales/invoices/${invoiceId}/items/`,
        { headers, signal }
      )
      if (!res.ok) {
        throw new Error(`Failed to fetch invoice items: ${res.status}`)
      }
      const data: InvoiceItemsResponse | InvoiceSummaryItemResponse[] = await res.json()
      if (process.env.NODE_ENV !== 'production') {
        console.log('Invoice items API response:', data)
      }
      // Handle both array and paginated response formats
      if (Array.isArray(data)) {
        return data
      }
      const itemsResponse = data as InvoiceItemsResponse
      return itemsResponse.results || itemsResponse.items || []
    } catch (error) {
      // Don't throw for aborted requests
      if (error instanceof DOMException && error.name === 'AbortError') {
        return []
      }
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching invoice items:", error)
      }
      throw error
    }
  }

  // Return type for rollback information
  type InventoryRollbackInfo = {
    inventoryUpdates: Array<{
      id?: number
      product_id?: number
      warehouse_id: number
      quantity: number
      notes?: string
    }>
    originalInventories: Array<{
      id?: number
      productId: number
      originalQuantity: number
      wasCreated: boolean
    }>
  }

  const returnItemsToWarehouse = async (
    invoiceItems: any[],
    warehouseId: number,
    signal?: AbortSignal
  ): Promise<InventoryRollbackInfo> => {
    try {
      // Step 1: Extract and validate product IDs
      const validItems = invoiceItems
        .map(item => {
          const productId = typeof item.product === 'object' ? item.product.id : item.product || item.product_id
          if (!productId) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('No product ID found for item:', item)
            }
            return null
          }
          return { productId, quantity: item.quantity || 0 }
        })
        .filter((item): item is { productId: number; quantity: number } => item !== null)

      if (validItems.length === 0) {
        throw new Error('No valid items to return to warehouse')
      }

      // Step 2: Fetch all inventory records in parallel
      const inventoryFetchPromises = validItems.map(item =>
        fetchWithRetry(
          `${API_URL}/inventory/inventory/?product_id=${item.productId}&warehouse_id=${warehouseId}`,
          { headers, signal }
        ).then(async (res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch inventory for product ${item.productId}: ${res.status}`)
          }
          const data = await res.json()
          const existingInventory = data.results?.[0] || data[0]
          return {
            productId: item.productId,
            quantity: item.quantity,
            existingInventory: existingInventory || null
          }
        })
      )

      const inventoryResults = await Promise.allSettled(inventoryFetchPromises)

      // Step 3: Process results and prepare bulk update data
      const inventoryUpdates: Array<{
        id?: number
        product_id?: number
        warehouse_id: number
        quantity: number
        notes?: string
      }> = []
      const originalInventories: Array<{
        id?: number
        productId: number
        originalQuantity: number
        wasCreated: boolean
      }> = []
      const errors: string[] = []

      inventoryResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          const productId = validItems[index].productId
          errors.push(`Failed to fetch inventory for product ${productId}: ${result.reason}`)
          return
        }

        const { productId, quantity, existingInventory } = result.value

        if (existingInventory) {
          // Update existing inventory by adding back the quantity
          const newQuantity = existingInventory.quantity + quantity
          inventoryUpdates.push({
            id: existingInventory.id,
            warehouse_id: warehouseId, // Include for consistency
            quantity: newQuantity,
            notes: existingInventory.notes || ''
          })
          // Store original for rollback
          originalInventories.push({
            id: existingInventory.id,
            productId: productId,
            originalQuantity: existingInventory.quantity,
            wasCreated: false
          })
        } else {
          // Create new inventory record
          inventoryUpdates.push({
            product_id: productId,
            warehouse_id: warehouseId,
            quantity: quantity,
            notes: 'Returned from deleted invoice'
          })
          // Store info for rollback (will need to delete this)
          originalInventories.push({
            productId: productId,
            originalQuantity: 0,
            wasCreated: true
          })
        }
      })

      // If there were any fetch errors, throw before attempting updates
      if (errors.length > 0) {
        throw new Error(`Failed to fetch some inventory records: ${errors.join('; ')}`)
      }

      // Step 4: Batch update all inventory using bulk API
      if (inventoryUpdates.length > 0) {
        const bulkUpdateResponse = await fetchWithRetry(`${API_URL}/inventory/inventory/bulk/`, {
          method: "POST",
          headers,
          body: JSON.stringify(inventoryUpdates),
          signal
        })

        if (!bulkUpdateResponse.ok) {
          const errorData = await bulkUpdateResponse.json().catch(() => ({}))
          const errorMessage = errorData.detail || errorData.message || `Bulk inventory update failed (${bulkUpdateResponse.status})`
          throw new Error(errorMessage)
        }

        // Verify the response and update IDs for created items
        const bulkData = await bulkUpdateResponse.json()
        const results = bulkData.results || bulkData
        
        // Update originalInventories with new IDs for created items
        if (Array.isArray(results)) {
          results.forEach((updatedInventory: any, index: number) => {
            const original = originalInventories[index]
            if (original && original.wasCreated && updatedInventory.id) {
              original.id = updatedInventory.id
            }
          })
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log(`Successfully returned ${inventoryUpdates.length} items to warehouse`)
        }
      }

      return {
        inventoryUpdates,
        originalInventories
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error returning items to warehouse:", error)
      }
      throw error
    }
  }

  // Rollback function to reverse inventory changes
  const rollbackInventoryReturn = async (
    rollbackInfo: InventoryRollbackInfo,
    signal?: AbortSignal
  ): Promise<void> => {
    const rollbackErrors: string[] = []

    // Prepare rollback updates (restore original quantities or delete created items)
    const rollbackUpdates: Array<{
      id?: number
      product_id?: number
      warehouse_id: number
      quantity: number
      notes?: string
    }> = []
    const itemsToDelete: number[] = []

    rollbackInfo.originalInventories.forEach((original, index) => {
      if (original.wasCreated && original.id) {
        // Item was created, need to delete it
        itemsToDelete.push(original.id)
      } else if (original.id) {
        // Item was updated, restore original quantity
        const update = rollbackInfo.inventoryUpdates[index]
        if (update) {
          rollbackUpdates.push({
            id: original.id,
            warehouse_id: update.warehouse_id,
            quantity: original.originalQuantity,
            notes: update.notes
          })
        }
      }
    })

    // Delete created inventory items
    for (const itemId of itemsToDelete) {
      try {
        const deleteResponse = await fetchWithRetry(`${API_URL}/inventory/inventory/${itemId}/delete/`, {
          method: "DELETE",
          headers,
          signal
        })
        if (!deleteResponse.ok) {
          rollbackErrors.push(`Failed to delete inventory item ${itemId}`)
        }
      } catch (error) {
        rollbackErrors.push(
          `Error deleting inventory item ${itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    // Restore original quantities for updated items
    if (rollbackUpdates.length > 0) {
      try {
        const rollbackResponse = await fetchWithRetry(`${API_URL}/inventory/inventory/bulk/`, {
          method: "POST",
          headers,
          body: JSON.stringify(rollbackUpdates),
          signal
        })
        if (!rollbackResponse.ok) {
          rollbackErrors.push(`Failed to rollback inventory updates`)
        }
      } catch (error) {
        rollbackErrors.push(
          `Error rolling back inventory updates: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    if (rollbackErrors.length > 0) {
      throw new Error(`Rollback completed with errors: ${rollbackErrors.join('; ')}`)
    }
  }

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete || deleteConfirmation !== "DELETE") return

    // Abort previous request if still pending
    deleteAbortControllerRef.current?.abort()
    deleteAbortControllerRef.current = new AbortController()
    const signal = deleteAbortControllerRef.current.signal

    setIsDeletingInvoice(true)
    let inventoryRollbackInfo: InventoryRollbackInfo | null = null
    let needsManualReconciliation = false

    try {
      // First, fetch the invoice items to get product details and quantities
      const invoiceItems = await fetchInvoiceItems(invoiceToDelete.id, signal)
      
      // Return items to warehouse before deleting the invoice
      if (invoiceItems.length > 0 && invoiceToDelete.warehouse?.id) {
        inventoryRollbackInfo = await returnItemsToWarehouse(
          invoiceItems,
          invoiceToDelete.warehouse.id,
          signal
        )
      }

      // Now delete the invoice
      const res = await fetchWithRetry(`${API_URL}/sales/invoices/${invoiceToDelete.id}/delete/`, {
        method: "DELETE",
        headers,
        signal
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = errorData.detail || errorData.message || "Failed to delete invoice"
        
        // Rollback inventory changes if invoice deletion failed
        if (inventoryRollbackInfo) {
          try {
            await rollbackInventoryReturn(inventoryRollbackInfo, signal)
            throw new Error(`${errorMessage} Inventory changes have been rolled back.`)
          } catch (rollbackError) {
            // Rollback failed - need manual reconciliation
            needsManualReconciliation = true
            throw new Error(
              `${errorMessage} Rollback failed. Invoice ID: ${invoiceToDelete.id}. ` +
              `Items were returned to warehouse but invoice deletion failed. Please contact support for manual reconciliation.`
            )
          }
        } else {
          throw new Error(errorMessage)
        }
      }

      // Success - invoice deleted and inventory updated
      setInvoices(invoices.filter((i) => i.id !== invoiceToDelete.id))
      toast({
        title: "Invoice Deleted",
        description: "Invoice has been deleted successfully and items returned to warehouse",
        variant: "default",
      })
      setInvoiceToDelete(null)
      setDeleteConfirmation("")
      setActiveDialog(null)
    } catch (error) {
      // Don't show error for aborted requests
      if (error instanceof DOMException && error.name === 'AbortError') {
        setIsDeletingInvoice(false)
        return
      }
      
      const errorMessage = error instanceof Error ? error.message : "Failed to delete invoice"
      
      handleError(
        error,
        errorMessage,
        {
          title: needsManualReconciliation ? "Error - Manual Reconciliation Required" : "Error",
          duration: needsManualReconciliation ? 10000 : 5000,
        }
      )
    } finally {
      setIsDeletingInvoice(false)
    }
  }

  const handleViewReceipt = (invoice: Invoice) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log("Opening receipt for invoice:", invoice);
    }
    // Navigate to receipt page with invoice ID
    window.open(`/receipt?id=${invoice.id}`, '_blank')
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
                  <BreadcrumbPage>Invoices</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <h2 className="text-xl font-semibold mb-4">Invoice Management</h2>
            <p className="mb-6">View and manage sales invoices.</p>

            {/* Filters Section */}
            <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6 w-full">
               <div className="space-y-2 flex-1 min-w-0">
                  <Label>Warehouse</Label>
                  <Select
                    value={selectedWarehouse?.toString() || "all"}
                    onValueChange={(value) => setSelectedWarehouse(value === "all" ? null : Number(value))}
                  >
                    <SelectTrigger className="w-full">
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

                <div className="space-y-2 flex-1 min-w-0">
                  <Label>Date Range</Label>
                  <div className="w-full">
                    <DatePickerWithRange
                      date={dateRange ?? { from: undefined, to: undefined }}
                      onDateChange={(range) => setDateRange(range ?? null)}
                    />
                  </div>
                </div>

                <form onSubmit={handleSearch} className="space-y-2 flex-1 min-w-0">
                  <Label>Invoice/Composite ID</Label>
                  <div className="flex gap-2">
                    <Input
                      className="flex-1 w-full"
                      placeholder="Search by invoice number or composite ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="flex gap-2 shrink-0">
                      <Button 
                        type="submit"
                        disabled={!selectedWarehouse && !dateRange?.from && !searchQuery}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </Button>
                      <Button variant="outline" onClick={handleResetFilters}>
                        Reset
                      </Button>
                    </div>
                  </div>
                </form>
            </div>

            {/* Selected Total Display */}
            {selectedTotal > 0 && (
              <div className="mb-4 p-4 bg-primary/10 rounded-md">
                <p className="text-lg font-semibold">
                  Selected Total: {selectedTotal.toFixed(3)} $
                </p>
              </div>
            )}

            {/* Invoices Table */}
            {!hasSearched ? (
              <div className="text-center text-muted-foreground py-12">
                Please select at least one filter (Warehouse, Date Range, or Invoice/Composite ID) to view invoices.
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
                        <th className="text-left font-medium p-2">Invoice #</th>
                        <th className="text-left font-medium p-2">Composite ID</th>
                        <th className="text-left font-medium p-2">Customer</th>
                        <th className="text-left font-medium p-2">Warehouse</th>
                        <th className="text-left font-medium p-2">Type</th>
                        <th className="text-left font-medium p-2">Date</th>
                        <th className="text-right font-medium p-2">Amount</th>
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
                            No invoices found
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
                            <td className="p-2 font-medium">{invoice.invoice_number}</td>
                            <td className="p-2 font-mono text-sm">{invoice.composite_id || 'N/A'}</td>
                            <td className="p-2">{invoice.customer?.institution_name || 'No Customer'}</td>
                            <td className="p-2">{invoice.warehouse?.name_en || 'No Warehouse'}</td>
                            <td className="p-2">
                              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                {invoice.invoice_type?.display_name_en || 'No Type'}
                              </span>
                            </td>
                            <td className="p-2">{invoice.created_at ? format(new Date(invoice.created_at), "PPP") : 'No Date'}</td>
                            <td className="p-2 text-right">{(invoice.total_amount || 0).toFixed(3)} $</td>
                            <td className="p-2 text-right space-x-2">
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

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewReceipt(invoice)}
                              >
                                <Receipt className="h-4 w-4 mr-2" />
                                Receipt
                              </Button>

                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => {
                                  setInvoiceToDelete(invoice)
                                  setActiveDialog('delete')
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
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
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              Invoice #{selectedInvoice?.invoice_number} - {selectedInvoice?.customer?.institution_name || 'No Customer'}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Customer Information</h3>
                  <p>{selectedInvoice.customer?.institution_name || 'No Customer'}</p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.customer?.contact_person || 'No Contact Person'}</p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Invoice Information</h3>
                  <p>Invoice #: {selectedInvoice.invoice_number}</p>
                  <p>Composite ID: {selectedInvoice.composite_id || 'N/A'}</p>
                  <p>Date: {selectedInvoice.created_at ? format(new Date(selectedInvoice.created_at), "PPP") : 'No Date'}</p>
                  <p>Warehouse: {selectedInvoice.warehouse?.name_en || 'No Warehouse'}</p>
                  <p>Type: {selectedInvoice.invoice_type?.display_name_en || 'No Type'}</p>
                  <p>Payment Method: {selectedInvoice.payment_method?.display_name_en || 'No Payment Method'}</p>
                </div>
              </div>

              <Separator />

              {/* Invoice Items */}
              <div>
                <h3 className="font-medium mb-4">Items</h3>
                <div className="border rounded-md">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-sm border-b">
                        <th className="text-left font-medium p-2">Product</th>
                        <th className="text-right font-medium p-2">Quantity</th>
                        <th className="text-right font-medium p-2">Unit Price</th>
                        <th className="text-right font-medium p-2">Discount</th>
                        <th className="text-right font-medium p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items?.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="p-2">
                            <div>
                              <p className="font-medium">{item.product?.title_en || 'No Title'}</p>
                              <p className="text-sm text-muted-foreground">{item.product?.title_ar || 'No Arabic Title'}</p>
                            </div>
                          </td>
                          <td className="p-2 text-right">{item.quantity || 0}</td>
                          <td className="p-2 text-right">{(item.unit_price || 0).toFixed(3)} $</td>
                          <td className="p-2 text-right">{item.discount_percent || 0}%</td>
                          <td className="p-2 text-right">{(item.total_price || 0).toFixed(3)} $</td>
                        </tr>
                      )) || (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-muted-foreground">
                            No items found
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t">
                        <td colSpan={4} className="p-2 text-right font-medium">
                          Subtotal:
                        </td>
                        <td className="p-2 text-right font-medium">
                          {invoiceTotals.subtotal.toFixed(3)} $
                        </td>
                      </tr>
                      {selectedInvoice.tax_percent && invoiceTotals.taxAmount > 0 && (
                        <tr className="border-t">
                          <td colSpan={4} className="p-2 text-right font-medium">
                            Tax ({selectedInvoice.tax_percent}%):
                          </td>
                          <td className="p-2 text-right font-medium">
                            {invoiceTotals.taxAmount.toFixed(3)} $
                          </td>
                        </tr>
                      )}
                      <tr className="border-t-2 border-gray-400">
                        <td colSpan={4} className="p-2 text-right font-bold text-lg">
                          TOTAL:
                        </td>
                        <td className="p-2 text-right font-bold text-lg">
                          {invoiceTotals.total.toFixed(3)} $
                        </td>
                      </tr>
                      <tr className="border-t">
                        <td colSpan={4} className="p-2 text-right font-medium">
                          Total Paid:
                        </td>
                        <td className="p-2 text-right font-medium">
                          {invoiceTotals.totalPaid.toFixed(3)} $
                        </td>
                      </tr>
                      <tr className="border-t">
                        <td colSpan={4} className="p-2 text-right font-medium">
                          Amount Due:
                        </td>
                        <td className="p-2 text-right font-medium">
                          {invoiceTotals.amountDue.toFixed(3)} $
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes Section */}
              {selectedInvoice.notes && (
                <div>
                  <h3 className="font-medium mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-md">
                    {selectedInvoice.notes}
                  </p>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setActiveDialog(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>



      {/* Delete Invoice Dialog */}
      <Dialog open={activeDialog === 'delete'} onOpenChange={(open) => setActiveDialog(open ? 'delete' : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm font-medium text-yellow-800 mb-1">⚠️ Important:</p>
                <p className="text-sm text-yellow-700">
                  All items from this invoice will be automatically returned to the warehouse ({invoiceToDelete?.warehouse?.name_en || "Unknown Warehouse"}) before deletion.
                </p>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Invoice Details:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>Invoice #: {invoiceToDelete?.invoice_number || "N/A"}</li>
                  <li>Composite ID: {invoiceToDelete?.composite_id || "N/A"}</li>
                  <li>Customer: {invoiceToDelete?.customer?.institution_name || "No Customer"}</li>
                  <li>Date: {invoiceToDelete?.created_at ? format(new Date(invoiceToDelete.created_at), "PPP") : "No Date"}</li>
                  <li>Amount: {(invoiceToDelete?.total_amount || 0).toFixed(3)} $</li>
                </ul>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Type DELETE to confirm:</p>
                <Input
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full"
                />
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => {
              setActiveDialog(null)
              setInvoiceToDelete(null)
              setDeleteConfirmation("")
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteInvoice}
              disabled={deleteConfirmation !== "DELETE" || isDeletingInvoice}
            >
              {isDeletingInvoice ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Invoice"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </SidebarProvider>
  )
}

