"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
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
import { FileText, ChevronDown, ChevronUp, Search, Link as LinkIcon, Trash2, Plus } from "lucide-react"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { CalendarIcon } from "lucide-react"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { Checkbox } from "@/components/ui/checkbox"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"

interface Customer {
  id: number
  institution_name: string
  contact_person: string
  customer_type?: string
}

interface Warehouse {
  id: number
  name_en: string
  name_ar: string
}

interface Product {
  id: number
  name_en: string
  name_ar: string
  title?: string
  title_ar?: string
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
  is_returnable: boolean
  items: InvoiceItem[]
  total_amount: number
  total_paid: number
  remaining_amount: number
  notes: string
  created_at_formatted: string
  created_by: number
  updated_by: number
  created_at: string
  updated_at: string
  selected?: boolean
  // Nested objects from API
  customer?: Customer
  warehouse?: Warehouse
  invoice_type?: {
    id: number
    display_name_en?: string
    name_en?: string
    value?: string
  }
  payment_method?: {
    id: number
    display_name_en?: string
    name_en?: string
    value?: string
  }
}

interface InvoiceItem {
  id?: number
  product_name: string
  quantity: number | string
  unit_price: number | string
  discount_percent: number | string
  tax_percent: number | string
  total_price: number | string
  paid_amount?: number | string
  remaining_amount?: number | string
  is_paid?: boolean
  selected?: boolean
  // Nested product object from API
  product?: Product
}

export default function OutstandingPaymentPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isViewInvoiceOpen, setIsViewInvoiceOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTotal, setSelectedTotal] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([])
  const [isGenerateBillOpen, setIsGenerateBillOpen] = useState(false)
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [isConfirmBillOpen, setIsConfirmBillOpen] = useState(false)
  const [showOnlyUnpaid, setShowOnlyUnpaid] = useState(false)

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }

  useEffect(() => {
    fetchWarehouses()
  }, [])

  const fetchWarehouses = async () => {
    try {
      const res = await fetch(`${API_URL}/inventory/warehouses/`, { headers })
      const data = await res.json()
      setWarehouses(Array.isArray(data) ? data : data.results || [])
    } catch (error) {
      console.error("Error fetching warehouses:", error)
      toast({
        title: "Error",
        description: "Failed to fetch warehouses",
        variant: "destructive",
      })
    }
  }

  const fetchInvoices = async () => {
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
      
      if (searchQuery) {
        params.append('search', searchQuery)
      }

      // Use the new outstanding payments endpoint
      const url = `${API_URL}/sales/invoices/outstanding-payments/${params.toString() ? `?${params.toString()}` : ''}`
      
      const response = await fetch(url, { headers })
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in again.')
        } else if (response.status === 403) {
          throw new Error('Access denied. You do not have permission to view this data.')
        } else {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
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
        console.warn('Unexpected API response structure:', data)
        transformedInvoices = []
      }
      
      // Transform the data to match our interface structure
      const mappedInvoices = transformedInvoices.map((invoice: any) => {
        // Debug logging to see the actual structure
        console.log('Invoice structure:', invoice)
        console.log('Invoice customer:', invoice.customer)
        console.log('Invoice warehouse:', invoice.warehouse)
        console.log('Invoice invoice_type:', invoice.invoice_type)
        console.log('Invoice payment_method:', invoice.payment_method)
        console.log('Invoice items:', invoice.items)
        console.log('Invoice invoice_items:', invoice.invoice_items)
        console.log('Invoice composite_id:', invoice.composite_id)
        
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
          // Ensure other properties are properly mapped
          total_amount: invoice.total_amount || 0,
          total_paid: invoice.total_paid || invoice.total_paid_amount || 0,
          remaining_amount: invoice.remaining_amount || 
                           (invoice.total_amount || 0) - (invoice.total_paid || invoice.total_paid_amount || 0),
          created_at: invoice.created_at || invoice.created_at_formatted || '',
          updated_at: invoice.updated_at || '',
          // Try multiple possible field names for items and map product names
          items: (invoice.items || invoice.invoice_items || invoice.line_items || []).map((item: any) => ({
            ...item,
            // Map nested product object to flat product_name with multiple fallbacks
            product_name: item.product?.name_en || 
                         item.product?.title_en || 
                         item.product?.title || 
                         item.product?.name || 
                         item.product_name || 
                         'No Product Name',
            // Keep the nested product object for reference
            product: item.product
          })),
          selected: false
        }
      })
      
      // The outstanding-payments endpoint already returns only invoices where is_fully_paid = False
      // No need for additional filtering since the endpoint handles this logic
      setInvoices(mappedInvoices)
      setHasSearched(true)
    } catch (error) {
      console.error("Error fetching invoices:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch invoices"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewInvoice = async (invoice: Invoice) => {
    console.log('Viewing invoice:', invoice)
    console.log('Invoice items:', invoice.items)
    
    // Debug: Log the structure of each item
    if (invoice.items && invoice.items.length > 0) {
      console.log('First item structure:', invoice.items[0])
      console.log('Item IDs:', invoice.items.map(item => ({ id: item.id, product_name: item.product_name })))
    }
    
    // Always fetch the complete invoice details to ensure we have all the data
      setIsLoadingItems(true)
      try {
      console.log('Fetching complete invoice details for:', invoice.id)
      const response = await fetch(`${API_URL}/sales/invoices/${invoice.id}/summary/`, { headers })
        
        if (response.ok) {
        const invoiceData = await response.json()
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
              console.warn('Detected possible product type instead of invoice type:', typeName)
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
          items: (invoiceData.items || []).map((item: any) => ({
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
          console.log('Fetching detailed items for invoice:', invoice.id)
          const itemsResponse = await fetch(`${API_URL}/sales/invoices/${invoice.id}/items/`, { headers })
          
          if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json()
            console.log('Fetched detailed items:', itemsData)
            
            // Merge the detailed items data with the summary data
            const detailedItems = itemsData.results || itemsData.items || itemsData || []
            console.log('Detailed items from API:', detailedItems)
            
            const mergedItems = mappedInvoice.items.map((summaryItem: any, index: number) => {
              // Try to match by ID first, then by index
              const detailedItem = detailedItems.find((item: any) => item.id === summaryItem.id) || 
                                  detailedItems.find((item: any) => item.product === summaryItem.product) ||
                                  detailedItems[index]
              
              console.log(`Merging item ${index}:`, {
                summaryItem,
                detailedItem,
                product: detailedItem?.product || summaryItem.product
              })
              
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
            
            const finalInvoice = {
              ...mappedInvoice,
              items: mergedItems
            }
            
            setSelectedInvoice(finalInvoice)
        } else {
            console.warn('Failed to fetch detailed items for invoice:', invoice.id)
            setSelectedInvoice(mappedInvoice)
          }
        } catch (error) {
          console.error('Error fetching detailed items:', error)
          setSelectedInvoice(mappedInvoice)
        }
      } else {
        console.warn('Failed to fetch complete invoice details for:', invoice.id)
          setSelectedInvoice(invoice)
        }
      } catch (error) {
      console.error('Error fetching complete invoice details:', error)
        setSelectedInvoice(invoice)
      } finally {
        setIsLoadingItems(false)
    }
    
    // Note: We now always fetch complete invoice details above, so this section is no longer needed
    
    setShowOnlyUnpaid(false) // Reset filter when opening new invoice
    setIsViewInvoiceOpen(true)
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

  const calculateSelectedTotal = () => {
    const total = invoices
      .filter(invoice => invoice.selected)
      .reduce((sum, invoice) => sum + (invoice.remaining_amount || 0), 0)
    setSelectedTotal(total)
  }

  useEffect(() => {
    calculateSelectedTotal()
  }, [invoices])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchInvoices()
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
    setIsGenerateBillOpen(true)
  }

  const handleConfirmGenerateBill = () => {
    setIsGenerateBillOpen(false)
    setIsConfirmBillOpen(true)
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

    try {
      setIsLoading(true)
      const token = localStorage.getItem("accessToken")
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }

      const originalInvoiceId = selectedInvoice.id
    const totalAmount = selectedItems.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0)

      console.log("Selected items for new bill:", selectedItems)
      console.log("Original invoice data:", originalInvoice)

      // Step 1: Get or create postpaid payment method (same as POS)
      let postpaidPaymentMethodId = null
      try {
        const paymentMethodsResponse = await fetch(`${API_URL}/common/list-items/payment_method/`, { headers })
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
            const createPaymentMethodResponse = await fetch(`${API_URL}/common/list-items/payment_method/`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                value: "postpaid",
                display_name_en: "Postpaid",
                display_name_ar: "مدفوع مسبقاً"
              })
            })
            
            if (createPaymentMethodResponse.ok) {
              const newPaymentMethod = await createPaymentMethodResponse.json()
              postpaidPaymentMethodId = newPaymentMethod.id
            } else {
              throw new Error("Failed to create postpaid payment method")
            }
          }
        }
      } catch (error) {
        console.error("Error handling payment method:", error)
        toast({
          title: "Error",
          description: "Failed to setup payment method for new bill",
          variant: "destructive",
        })
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
            console.log("Fetching original invoice details to get invoice type ID")
            const originalInvoiceResponse = await fetch(`${API_URL}/sales/invoices/${selectedInvoice.id}/`, { headers })
            if (originalInvoiceResponse.ok) {
              const originalInvoiceData = await originalInvoiceResponse.json()
              if (originalInvoiceData.invoice_type?.id) {
                originalInvoiceTypeId = originalInvoiceData.invoice_type.id
                console.log("Found invoice type ID from API:", originalInvoiceTypeId)
              }
            }
          } catch (error) {
            console.warn("Failed to fetch original invoice details for type ID:", error)
          }
        }
      }
      
      console.log("Using invoice type ID:", originalInvoiceTypeId, "for original invoice type:", originalInvoice.invoice_type_name)
      
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
      console.log("=== INVOICE CREATION DEBUG ===")
      console.log("Original invoice ID:", originalInvoiceId)
      console.log("Original invoice data:", originalInvoice)
      console.log("Invoice data to send:", JSON.stringify(invoiceData, null, 2))
      console.log("Expected main_invoice_id:", originalInvoiceId)
      console.log("=== END DEBUG ===")
      
      console.log("Creating invoice with data:", invoiceData)

      const invoiceResponse = await fetch(`${API_URL}/sales/invoices/`, {
        method: "POST",
        headers,
        body: JSON.stringify(invoiceData),
      })

      if (!invoiceResponse.ok) {
        const errorData = await invoiceResponse.json()
        console.error("Invoice creation error:", errorData)
        throw new Error(errorData.message || errorData.detail || "Failed to create invoice")
      }

      const invoice = await invoiceResponse.json()
      const invoiceId = invoice.id
      console.log("New invoice created:", invoice)
      console.log("Invoice data sent to API:", invoiceData)
      console.log("Expected main_invoice_id:", originalInvoiceId)
      console.log("Expected composite_id format:", `${originalInvoiceId}_${invoiceId}`)

      // // Step 2.5: Update the invoice to ensure composite_id is set correctly
      // const expectedCompositeId = `${originalInvoiceId}_${invoiceId}`
      // console.log("Updating invoice to set composite_id:", expectedCompositeId)
      
      // const updateInvoiceData = {
      //   main_invoice_id: originalInvoiceId,
      //   parent_invoice_id: originalInvoiceId, // Try alternative field name
      //   composite_id: expectedCompositeId
      // }
      
      // const updateInvoiceResponse = await fetch(`${API_URL}/sales/invoices/${invoiceId}/`, {
      //   method: "PATCH",
      //   headers,
      //   body: JSON.stringify(updateInvoiceData),
      // })
      
      // if (updateInvoiceResponse.ok) {
      //   const updatedInvoice = await updateInvoiceResponse.json()
      //   console.log("Invoice updated with composite_id:", updatedInvoice)
      //   console.log("Updated invoice main_invoice_id:", updatedInvoice.main_invoice_id)
      //   console.log("Updated invoice composite_id:", updatedInvoice.composite_id)
      // } else {
      //   const errorText = await updateInvoiceResponse.text()
      //   console.warn("Failed to update invoice with composite_id:", errorText)
      //   console.warn("Response status:", updateInvoiceResponse.status)
      // }

      // Step 3: Create invoice items (exactly like POS)
      for (const item of selectedItems) {
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
          console.error("No product ID found for item:", item)
          console.error("Item structure:", item)
          console.error("Original invoice items:", invoices.find(inv => inv.id === selectedInvoice.id)?.items)
          throw new Error(`No product ID found for item: ${item.product_name}`)
        }
        
        const itemData = {
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

        console.log("Creating item with data:", itemData)
        const itemResponse = await fetch(`${API_URL}/sales/invoice-items/`, {
          method: "POST",
          headers,
          body: JSON.stringify(itemData),
        })

        if (!itemResponse.ok) {
          const errorData = await itemResponse.json()
          console.error("Invoice item creation error:", errorData)
          throw new Error(errorData.message || errorData.detail || "Failed to create invoice item")
        }

        const createdItem = await itemResponse.json()
        console.log("Created invoice item:", createdItem)
      }

      // Step 4: Create payment record (exactly like POS)
      const paymentData = {
        invoice: invoiceId,
        amount: parseFloat(totalAmount.toFixed(2)),
        payment_date: new Date().toISOString().split('T')[0],
        notes: `Payment for generated bill from invoice #${originalInvoice.composite_id || originalInvoiceId}`,
      }

      const paymentResponse = await fetch(`${API_URL}/sales/payments/`, {
        method: "POST",
        headers,
        body: JSON.stringify(paymentData),
      })

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json()
        throw new Error(errorData.message || "Failed to create payment")
      }

      console.log("Payment record created successfully")

      // Step 5: Update original invoice items to mark them as paid
      console.log("Updating original invoice items...")
      for (const item of selectedItems) {
        if (item.id) {
          console.log(`Updating item ${item.id} in original invoice`)
          const updateItemResponse = await fetch(`${API_URL}/sales/invoice-items/${item.id}/`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              paid_amount: Number(item.total_price) || 0,
              remaining_amount: 0,
              is_paid: true,
            }),
          })

          if (!updateItemResponse.ok) {
            const errorData = await updateItemResponse.json()
            console.warn(`Failed to update item ${item.id} in original invoice:`, errorData)
          } else {
            console.log(`Successfully updated item ${item.id}`)
          }
        } else {
          console.warn("Item has no ID, cannot update:", item)
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

      const updateOriginalInvoiceData: any = {
        total_amount: newTotalAmount,
        total_paid: newTotalPaid,
        remaining_amount: newRemainingAmount,
        notes: `${selectedInvoice.notes || ''}\n\nItems removed and child bill generated: ${invoiceId} (composite_id: ${composedId}, main_invoice: ${originalInvoiceId})`,
      }

      if (isInvoiceFullyPaid) {
        updateOriginalInvoiceData.is_fully_paid = true
        updateOriginalInvoiceData.status = "paid"
      }

      console.log("Updating original invoice with data:", updateOriginalInvoiceData)
      const updateOriginalInvoiceResponse = await fetch(`${API_URL}/sales/invoices/${selectedInvoice.id}/`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(updateOriginalInvoiceData),
      })

      if (!updateOriginalInvoiceResponse.ok) {
        const errorData = await updateOriginalInvoiceResponse.json()
        console.error("Failed to update original invoice:", errorData)
        throw new Error(errorData.message || errorData.detail || "Failed to update original invoice")
      }

      const updatedInvoice = await updateOriginalInvoiceResponse.json()
      console.log("Updated original invoice:", updatedInvoice)

      // Success messages

      const successMessage = isInvoiceFullyPaid 
        ? `Child bill #${invoiceId} (composite_id: ${composedId}) created successfully! Main invoice #${originalInvoice.composite_id || originalInvoiceId} is now fully paid and will no longer appear in outstanding payments.`
        : `Child bill #${invoiceId} (composite_id: ${composedId}) created successfully! Main invoice #${originalInvoice.composite_id || originalInvoiceId} updated with ${remainingItems.length} remaining items.`

    toast({
        title: "New Bill Generated Successfully",
        description: successMessage,
      variant: "default",
    })

      toast({
        title: "Child Bill Details",
        description: `Child Bill ID: ${invoiceId}, Composite ID: ${composedId}, Main Invoice: ${originalInvoice.composite_id || originalInvoiceId}. View all invoices to see the new child bill.`,
        variant: "default",
        action: (
          <Link href="/invoices" className="text-primary hover:underline">
            View All Invoices
          </Link>
        ),
      })

      // Close dialogs and refresh data
    setIsGenerateBillOpen(false)
      setIsConfirmBillOpen(false)
    setIsViewInvoiceOpen(false)
    setSelectedItems([])
    setSelectedInvoice(null)

      // Refresh the invoices list
      await fetchInvoices()

      // Verify the new bill was created
      try {
        const verifyResponse = await fetch(`${API_URL}/sales/invoices/${invoiceId}/`, { headers })
        if (verifyResponse.ok) {
          const verifiedInvoice = await verifyResponse.json()
          console.log("Verified new bill exists:", verifiedInvoice)
        } else {
          console.warn("Could not verify new bill creation")
        }
      } catch (error) {
        console.warn("Error verifying new bill:", error)
      }

    } catch (error) {
      console.error("Error creating new bill:", error)
      let errorMessage = "Failed to create new bill. Please try again."
      
      if (error instanceof Error) {
        if (error.message.includes("composite_id")) {
          errorMessage = "Backend error: Invoice creation failed due to composite_id constraint. Please contact support."
        } else if (error.message.includes("Duplicate entry")) {
          errorMessage = "Backend error: Duplicate invoice entry. Please try again."
        } else {
          errorMessage = error.message
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
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
            <div className="mb-6 p-4 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Invoice ID Format:</strong> Main invoices show as single ID (e.g., "121"), while child invoices show as "main_invoice_id_child_bill_id" (e.g., "121_223"). 
                Child invoices are generated from outstanding payments and are marked with a blue "Child" badge. The main_invoice_id field contains the ID of the original invoice.
              </p>
            </div>

            {/* Filters Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

              {/* Search Filter */}
              <div className="space-y-2">
                  <Label>Search</Label>
                    <Input
                  className="w-full h-10"
                      placeholder="Search by invoice ID (e.g., 121 or 121_223) or customer..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
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
                        fetchInvoices()
              }} disabled={isLoading}>
                {isLoading ? "Loading..." : "Load Outstanding"}
                      </Button>
            </div>

            {/* Selected Total Display */}
            {selectedTotal > 0 && (
              <div className="mb-4 p-4 bg-primary/10 rounded-md">
                <p className="text-lg font-semibold">
                  Selected Outstanding Total: {selectedTotal.toFixed(3)} OMR
                </p>
              </div>
            )}

            {/* Invoices Table */}
            {!hasSearched ? (
              <div className="text-center text-muted-foreground py-12">
                <p>Click "Search" to view all outstanding invoices (unpaid and partially paid) or use filters to narrow down results.</p>
                <p className="text-sm mt-2">You can search by invoice ID (e.g., "121" or "121_223"), customer name, or use date/warehouse filters.</p>
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
                            <td className="p-2 text-right">{(invoice.total_amount || 0).toFixed(3)} OMR</td>
                            <td className="p-2 text-right">{(invoice.total_paid || 0).toFixed(3)} OMR</td>
                            <td className="p-2 text-right font-semibold text-red-600">
                              {(invoice.remaining_amount || 0).toFixed(3)} OMR
                            </td>
                            <td className="p-2 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewInvoice(invoice)}
                                disabled={isLoadingItems}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                {isLoadingItems ? "Loading..." : "View"}
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
      <Dialog open={isViewInvoiceOpen} onOpenChange={setIsViewInvoiceOpen}>
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
                  <p className="text-lg font-semibold">{(selectedInvoice.total_amount || 0).toFixed(3)} OMR</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid Amount</p>
                  <p className="text-lg font-semibold text-green-600">{(selectedInvoice.total_paid || 0).toFixed(3)} OMR</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-lg font-semibold text-red-600">{(selectedInvoice.remaining_amount || 0).toFixed(3)} OMR</p>
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
                      disabled={!selectedInvoice.items?.some(item => item.selected && !item.is_paid) || isLoading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                      {isLoading ? "Processing..." : "Generate Child Bill"}
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
                                    {item.product?.name_ar || item.product?.title_ar || 'No Arabic Title'}
                                  </p>
                              </div>
                            </td>
                              <td className={`p-2 text-right ${isPaid ? 'text-green-700' : ''}`}>{Number(item.quantity) || 0}</td>
                              <td className={`p-2 text-right ${isPaid ? 'text-green-700' : ''}`}>{(Number(item.unit_price) || 0).toFixed(3)} OMR</td>
                              <td className={`p-2 text-right ${isPaid ? 'text-green-700' : ''}`}>{Number(item.discount_percent) || 0}%</td>
                              <td className={`p-2 text-right ${isPaid ? 'text-green-700' : ''}`}>{Number(item.tax_percent) || 0}%</td>
                              <td className={`p-2 text-right ${isPaid ? 'text-green-700 font-semibold' : ''}`}>
                                {(Number(item.total_price) || 0).toFixed(3)} OMR
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
      <Dialog open={isGenerateBillOpen} onOpenChange={setIsGenerateBillOpen}>
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
                  <p className="text-lg font-semibold text-green-600">{selectedItems.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0).toFixed(3)} OMR</p>
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
                              <p className="text-sm text-muted-foreground">{item.product?.name_ar || item.product?.title_ar || 'No Arabic Title'}</p>
                            </div>
                          </td>
                          <td className="p-2 text-right">{Number(item.quantity) || 0}</td>
                          <td className="p-2 text-right">{(Number(item.unit_price) || 0).toFixed(3)} OMR</td>
                          <td className="text-right">{Number(item.discount_percent) || 0}%</td>
                          <td className="p-2 text-right">{Number(item.tax_percent) || 0}%</td>
                          <td className="p-2 text-right">{(Number(item.total_price) || 0).toFixed(3)} OMR</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t">
                        <td colSpan={4} className="p-2 text-right font-medium">
                          Total Amount:
                        </td>
                        <td className="p-2 text-right font-medium">
                          {selectedItems.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0).toFixed(3)} OMR
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsGenerateBillOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmGenerateBill} disabled={isLoading}>
                  <Plus className="h-4 w-4 mr-2" />
                  Review & Create Child Bill
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmBillOpen} onOpenChange={setIsConfirmBillOpen}>
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
              <Button variant="outline" onClick={() => setIsConfirmBillOpen(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleCreateNewBill} disabled={isLoading}>
                <Plus className="h-4 w-4 mr-2" />
                {isLoading ? "Creating..." : "Create Child Bill"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}

