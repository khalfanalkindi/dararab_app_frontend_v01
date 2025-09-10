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
import { FileText, ChevronDown, ChevronUp, Search, Trash2, Receipt } from "lucide-react"
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

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

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isViewInvoiceOpen, setIsViewInvoiceOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTotal, setSelectedTotal] = useState(0)
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

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
      if (searchQuery) {
        params.append("search", searchQuery)
      }
      params.append("page_size", "1000")
      params.append("ordering", "-created_at") // Order by created_at in descending order

      const queryString = params.toString()
      if (queryString) {
        url += `?${queryString}`
      }

      const res = await fetch(url, { headers })
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
      console.error("Error fetching invoices:", error)
      toast({
        title: "Error",
        description: "Failed to fetch invoices",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewInvoice = async (invoice: Invoice) => {
    try {
      const res = await fetch(`${API_URL}/sales/invoices/${invoice.id}/summary/`, { headers })
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const data = await res.json()
      console.log('Invoice API Response:', data)
      
      // Process the data according to the InvoiceSummarySerializer structure
      const processedData = {
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
        total_amount: data.total_amount,
        global_discount_percent: data.global_discount_percent || "0.00",
        tax_percent: data.tax_percent || "0.00",
        total_paid: data.total_paid,
        remaining_amount: data.remaining_amount,
        status: data.total_paid >= (data.total_amount * (1 - parseFloat(data.global_discount_percent || "0") / 100) * (1 + parseFloat(data.tax_percent || "0") / 100)) ? 'Paid' : 'Partial', // Calculate status based on final total
        items: data.items?.map((item: any) => ({
          id: item.id || 0,
          product: {
            id: 0, // Not provided in the API response
            title_en: item.product_name || 'No Title',
            title_ar: item.product_name || 'No Arabic Title',
          },
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          total_price: item.total_price
        })) || [],
        notes: data.notes || ''
      }
      
      console.log('Processed invoice data:', processedData)
      
      setSelectedInvoice(processedData)
      setIsViewInvoiceOpen(true)
    } catch (error) {
      console.error("Error fetching invoice details:", error)
      toast({
        title: "Error",
        description: "Failed to fetch invoice details",
        variant: "destructive",
      })
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

  const calculateSelectedTotal = () => {
    const total = invoices
      .filter(invoice => invoice.selected)
      .reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0)
    setSelectedTotal(total)
  }

  useEffect(() => {
    calculateSelectedTotal()
  }, [invoices])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchInvoices()
  }

  const fetchInvoiceItems = async (invoiceId: number) => {
    try {
      const res = await fetch(`${API_URL}/sales/invoices/${invoiceId}/items/`, { headers })
      if (!res.ok) {
        throw new Error(`Failed to fetch invoice items: ${res.status}`)
      }
      const data = await res.json()
      console.log('Invoice items API response:', data)
      // Handle both array and paginated response formats
      return data.results || data.items || data || []
    } catch (error) {
      console.error("Error fetching invoice items:", error)
      throw error
    }
  }

  const returnItemsToWarehouse = async (invoiceItems: any[], warehouseId: number) => {
    try {
      for (const item of invoiceItems) {
        // Extract product ID from the item (could be item.product or item.product_id)
        const productId = typeof item.product === 'object' ? item.product.id : item.product || item.product_id
        
        if (!productId) {
          console.warn('No product ID found for item:', item)
          continue
        }
        
        console.log(`Processing item: product_id=${productId}, quantity=${item.quantity}`)
        
        // First, get current inventory for this product in the warehouse
        const inventoryRes = await fetch(
          `${API_URL}/inventory/inventory/?product_id=${productId}&warehouse_id=${warehouseId}`,
          { headers }
        )
        
        if (!inventoryRes.ok) {
          throw new Error(`Failed to fetch inventory for product ${productId}`)
        }
        
        const inventoryData = await inventoryRes.json()
        const existingInventory = inventoryData.results?.[0] || inventoryData[0]
        
        if (existingInventory) {
          // Update existing inventory by adding back the quantity
          const newQuantity = existingInventory.quantity + item.quantity
          console.log(`Updating existing inventory: ${existingInventory.quantity} + ${item.quantity} = ${newQuantity}`)
          
          const updateRes = await fetch(`${API_URL}/inventory/inventory/product/${productId}/update/`, {
            method: "PUT",
            headers,
            body: JSON.stringify({
              product_id: productId,
              warehouse_id: warehouseId,
              quantity: newQuantity,
              notes: existingInventory.notes || ''
            }),
          })
          
          if (!updateRes.ok) {
            const errorData = await updateRes.json()
            throw new Error(`Failed to update inventory: ${errorData.detail || errorData.message}`)
          }
        } else {
          // Create new inventory record
          console.log(`Creating new inventory record for product ${productId} with quantity ${item.quantity}`)
          
          const createRes = await fetch(`${API_URL}/inventory/inventory/`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              product: productId,
              warehouse: warehouseId,
              quantity: item.quantity,
              notes: 'Returned from deleted invoice'
            }),
          })
          
          if (!createRes.ok) {
            const errorData = await createRes.json()
            throw new Error(`Failed to create inventory: ${errorData.detail || errorData.message}`)
          }
        }
      }
    } catch (error) {
      console.error("Error returning items to warehouse:", error)
      throw error
    }
  }

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete || deleteConfirmation !== "DELETE") return

    try {
      // First, fetch the invoice items to get product details and quantities
      const invoiceItems = await fetchInvoiceItems(invoiceToDelete.id)
      
      // Return items to warehouse before deleting the invoice
      if (invoiceItems.length > 0 && invoiceToDelete.warehouse?.id) {
        await returnItemsToWarehouse(invoiceItems, invoiceToDelete.warehouse.id)
      }

      // Now delete the invoice
      const res = await fetch(`${API_URL}/sales/invoices/${invoiceToDelete.id}/delete/`, {
        method: "DELETE",
        headers,
      })

      if (!res.ok) {
        throw new Error("Failed to delete invoice")
      }

      setInvoices(invoices.filter((i) => i.id !== invoiceToDelete.id))
      toast({
        title: "Invoice Deleted",
        description: "Invoice has been deleted successfully and items returned to warehouse",
        variant: "default",
      })
      setInvoiceToDelete(null)
      setDeleteConfirmation("")
      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error deleting invoice:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete invoice",
        variant: "destructive",
      })
    }
  }

  const handleViewReceipt = (invoice: Invoice) => {
    console.log("Opening receipt for invoice:", invoice);
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
                  Selected Total: {selectedTotal.toFixed(3)} OMR
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
                            <td className="p-2 text-right">{(invoice.total_amount || 0).toFixed(3)} OMR</td>
                            <td className="p-2 text-right space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewInvoice(invoice)}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                View
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
                                  setIsDeleteDialogOpen(true)
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
      <Dialog open={isViewInvoiceOpen} onOpenChange={setIsViewInvoiceOpen}>
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
                          <td className="p-2 text-right">{(item.unit_price || 0).toFixed(3)} OMR</td>
                          <td className="p-2 text-right">{item.discount_percent || 0}%</td>
                          <td className="p-2 text-right">{(item.total_price || 0).toFixed(3)} OMR</td>
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
                          {(selectedInvoice.total_amount || 0).toFixed(3)} OMR
                        </td>
                      </tr>
                      {selectedInvoice.global_discount_percent && (
                        <tr className="border-t">
                          <td colSpan={4} className="p-2 text-right font-medium text-red-600">
                            Discount ({selectedInvoice.global_discount_percent}%):
                          </td>
                          <td className="p-2 text-right font-medium text-red-600">
                            -{((selectedInvoice.total_amount || 0) * parseFloat(selectedInvoice.global_discount_percent) / 100).toFixed(3)} OMR
                          </td>
                        </tr>
                      )}
                      {selectedInvoice.tax_percent && parseFloat(selectedInvoice.tax_percent) > 0 && (
                        <tr className="border-t">
                          <td colSpan={4} className="p-2 text-right font-medium">
                            Tax ({selectedInvoice.tax_percent}%):
                          </td>
                          <td className="p-2 text-right font-medium">
                            {((selectedInvoice.total_amount || 0) * (1 - parseFloat(selectedInvoice.global_discount_percent || "0") / 100) * parseFloat(selectedInvoice.tax_percent) / 100).toFixed(3)} OMR
                          </td>
                        </tr>
                      )}
                      <tr className="border-t-2 border-gray-400">
                        <td colSpan={4} className="p-2 text-right font-bold text-lg">
                          TOTAL:
                        </td>
                        <td className="p-2 text-right font-bold text-lg">
                          {(selectedInvoice.total_amount || 0).toFixed(3)} OMR
                        </td>
                      </tr>
                      <tr className="border-t">
                        <td colSpan={4} className="p-2 text-right font-medium">
                          Total Paid:
                        </td>
                        <td className="p-2 text-right font-medium">
                          {((selectedInvoice.total_amount || 0) * (1 - parseFloat(selectedInvoice.global_discount_percent || "0") / 100) * (1 + parseFloat(selectedInvoice.tax_percent || "0") / 100)).toFixed(3)} OMR
                        </td>
                      </tr>
                      <tr className="border-t">
                        <td colSpan={4} className="p-2 text-right font-medium">
                          Amount Due:
                        </td>
                        <td className="p-2 text-right font-medium">
                          {Math.max(0, ((selectedInvoice.total_amount || 0) * (1 - parseFloat(selectedInvoice.global_discount_percent || "0") / 100) * (1 + parseFloat(selectedInvoice.tax_percent || "0") / 100)) - (selectedInvoice.total_paid || 0)).toFixed(3)} OMR
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
                <Button onClick={() => setIsViewInvoiceOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>



      {/* Delete Invoice Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
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
                  <li>Amount: {(invoiceToDelete?.total_amount || 0).toFixed(3)} OMR</li>
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
              setIsDeleteDialogOpen(false)
              setInvoiceToDelete(null)
              setDeleteConfirmation("")
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteInvoice}
              disabled={deleteConfirmation !== "DELETE"}
            >
              Delete Invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </SidebarProvider>
  )
}

