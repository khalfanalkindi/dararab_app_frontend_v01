"use client"

import { ErrorBoundary } from "@/components/ErrorBoundary"
import { DocumentTitle } from "@/components/document-title"
import { PageBreadcrumb, DASHBOARD_CRUMB } from "@/components/page-breadcrumb"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { fetchWithRetry } from "@/lib/apiClient"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { toast } from "sonner"
import { format } from "date-fns"
import { DateRange } from "react-day-picker"
import { API_URL } from "@/lib/config"
import { buildReceiptPayloadFromSummary } from "@/components/receipt/buildReceiptPayload"
import type { ReceiptData } from "@/components/receipt/ReceiptContent"
import { downloadInvoiceDetailAsExcel } from "@/lib/exportInvoicesToExcel"

import { InvoiceFilters } from "./components/invoice-filters"
import { InvoiceTable } from "./components/invoice-table"
import { InvoiceViewDialog } from "./components/invoice-view-dialog"
import { InvoiceDeleteDialog } from "./components/invoice-delete-dialog"
import { InvoiceReceiptDialog } from "./components/invoice-receipt-dialog"
import type {
  Invoice,
  Warehouse,
  CustomerOption,
  DeleteErrorPayload,
  RowAction,
} from "./components/types"

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
  status?: string
}

// Helper function to calculate invoice status
const calculateInvoiceStatus = (
  totalPaid: number,
  totalAmount: number,
  globalDiscountPercent: string | number = 0,
  taxPercent: string | number = 0
): string => {
  const discount = parseFloat(String(globalDiscountPercent)) || 0
  const tax = parseFloat(String(taxPercent)) || 0
  const discountedAmount = totalAmount * (1 - discount / 100)
  const finalTotal = discountedAmount * (1 + tax / 100)

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
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deleteError, setDeleteError] = useState<DeleteErrorPayload | null>(null)
  const [showDeleteErrorDetails, setShowDeleteErrorDetails] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)

  const [loadingAction, setLoadingAction] = useState<{ id: number; action: RowAction } | null>(null)
  const isRowLoading = (id: number, action: RowAction) =>
    loadingAction?.id === id && loadingAction?.action === action

  type DialogType = 'view' | 'delete' | 'receipt' | null
  const [activeDialog, setActiveDialog] = useState<DialogType>(null)
  const [receiptPayload, setReceiptPayload] = useState<ReceiptData | null>(null)

  const warehousesAbortControllerRef = useRef<AbortController | null>(null)
  const customersAbortControllerRef = useRef<AbortController | null>(null)
  const invoicesAbortControllerRef = useRef<AbortController | null>(null)
  const invoiceDetailsAbortControllerRef = useRef<AbortController | null>(null)
  const receiptAbortControllerRef = useRef<AbortController | null>(null)
  const deleteAbortControllerRef = useRef<AbortController | null>(null)

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }), [])

  const handleError = (
    error: unknown,
    defaultMessage: string,
    options?: {
      title?: string
      duration?: number
      onError?: (error: Error) => void
    }
  ) => {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error("Error:", error)
    }

    let errorMessage = defaultMessage
    if (error instanceof Error) {
      errorMessage = error.message || defaultMessage
    }

    if (options?.onError && error instanceof Error) {
      options.onError(error)
    }

    toast.error(options?.title || "Error", { description: errorMessage })
  }

  useEffect(() => {
    fetchWarehouses()
    fetchCustomers()

    return () => {
      warehousesAbortControllerRef.current?.abort()
      customersAbortControllerRef.current?.abort()
      invoicesAbortControllerRef.current?.abort()
      invoiceDetailsAbortControllerRef.current?.abort()
      deleteAbortControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchAllPaginated = async <T,>(initialUrl: string, signal: AbortSignal): Promise<T[]> => {
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
  }

  const buildInvoicesUrl = useCallback(
    (options?: {
      search?: string
      customerId?: number | null
      page?: number
      pageSize?: number
    }) => {
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

      const searchValue = options?.search !== undefined ? options.search : debouncedSearchQuery
      const customerId =
        options?.customerId !== undefined ? options.customerId : selectedCustomerId

      if (searchValue) {
        params.append("search", searchValue)
      }
      if (customerId) {
        params.append("customer_id", customerId.toString())
      }

      params.append("page", String(options?.page ?? currentPage))
      params.append("page_size", String(options?.pageSize ?? pageSize))
      params.append("ordering", "-created_at")

      const queryString = params.toString()
      if (queryString) {
        url += `?${queryString}`
      }
      return url
    },
    [selectedWarehouse, dateRange, debouncedSearchQuery, selectedCustomerId, currentPage, pageSize],
  )

  const getCurrencyLabelForInvoice = useCallback(
    (warehouseName?: string, warehouseId?: number) => {
      const warehouse = warehouses.find(
        (w) => w.id === warehouseId || w.name_en === warehouseName || w.name_ar === warehouseName,
      )
      return warehouse?.location === "Muscat" ? "OMR" : "$"
    },
    [warehouses],
  )

  const handleExportInvoiceExcel = async (invoice: Invoice) => {
    setLoadingAction({ id: invoice.id, action: "export" })
    try {
      const res = await fetchWithRetry(`${API_URL}/sales/invoices/${invoice.id}/summary/`, {
        headers,
      })
      if (!res.ok) {
        throw new Error(`Failed to load invoice details (${res.status})`)
      }

      const data: InvoiceSummaryResponse = await res.json()
      const warehouse = warehouses.find(
        (w) => w.id === invoice.warehouse?.id || w.name_en === data.warehouse_name,
      )
      const receiptData = buildReceiptPayloadFromSummary({
        ...data,
        warehouse_location: warehouse?.location,
      })
      const currencyLabel = getCurrencyLabelForInvoice(data.warehouse_name, warehouse?.id)
      const filename = `invoice-${receiptData.composite_id || invoice.id}.xlsx`

      downloadInvoiceDetailAsExcel(receiptData, currencyLabel, filename)

      toast.success("Excel exported", {
        description: `Invoice ${receiptData.composite_id || invoice.id} downloaded.`,
      })
    } catch (error) {
      handleError(error, "Failed to export invoice to Excel")
    } finally {
      setLoadingAction(null)
    }
  }

  const fetchWarehouses = async () => {
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

  const fetchCustomers = async () => {
    customersAbortControllerRef.current?.abort()
    customersAbortControllerRef.current = new AbortController()

    setIsLoadingCustomers(true)
    try {
      const customersData = await fetchAllPaginated<CustomerOption>(
        `${API_URL}/sales/customers/?page_size=100`,
        customersAbortControllerRef.current.signal,
      )
      const sorted = [...customersData].sort((a, b) =>
        (a.institution_name || "").localeCompare(b.institution_name || "", undefined, {
          sensitivity: "base",
        }),
      )
      setCustomers(sorted)
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return
      handleError(error, "Failed to fetch customers")
      setCustomers([])
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  const fetchInvoices = async (options?: {
    search?: string
    customerId?: number | null
    page?: number
    pageSize?: number
  }) => {
    invoicesAbortControllerRef.current?.abort()
    invoicesAbortControllerRef.current = new AbortController()

    const page = options?.page ?? currentPage
    const size = options?.pageSize ?? pageSize

    setIsLoading(true)
    try {
      const url = buildInvoicesUrl({
        search: options?.search,
        customerId: options?.customerId,
        page,
        pageSize: size,
      })

      const res = await fetchWithRetry(url, {
        headers,
        signal: invoicesAbortControllerRef.current.signal
      })
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const data = await res.json()
      const invoicesData: Invoice[] = Array.isArray(data)
        ? data
        : Array.isArray(data.results)
        ? data.results
        : []

      setInvoices(invoicesData)
      setTotalCount(
        Array.isArray(data)
          ? invoicesData.length
          : typeof data.count === "number"
            ? data.count
            : invoicesData.length,
      )
      setCurrentPage(page)
      setPageSize(size)
      setHasSearched(true)
    } catch (error) {
      handleError(error, "Failed to fetch invoices")
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewInvoice = async (invoice: Invoice) => {
    invoiceDetailsAbortControllerRef.current?.abort()
    invoiceDetailsAbortControllerRef.current = new AbortController()

    setLoadingAction({ id: invoice.id, action: "view" })
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

      const totalAmount = typeof data.total_amount === 'string' ? parseFloat(data.total_amount) : data.total_amount
      const totalPaid = typeof data.total_paid === 'string' ? parseFloat(data.total_paid) : data.total_paid
      const remainingAmount = typeof data.remaining_amount === 'string' ? parseFloat(data.remaining_amount) : data.remaining_amount

      const status = data.status || calculateInvoiceStatus(
        totalPaid,
        totalAmount,
        data.global_discount_percent,
        data.tax_percent
      )

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
            id: 0,
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
      setLoadingAction(null)
    }
  }

  const handleResetFilters = () => {
    setSelectedWarehouse(null)
    setSelectedCustomerId(null)
    setDateRange(null)
    setSearchQuery("")
    setInvoices([])
    setHasSearched(false)
    setCurrentPage(1)
    setTotalCount(0)
  }

  const handleInvoiceSelect = (invoiceId: number) => {
    setInvoices(invoices.map(invoice =>
      invoice.id === invoiceId
        ? { ...invoice, selected: !invoice.selected }
        : invoice
    ))
  }

  const handleSelectAll = (selected: boolean) => {
    setInvoices(invoices.map(invoice => ({
      ...invoice,
      selected,
    })))
  }

  const selectedTotal = useMemo(() => {
    return invoices
      .filter(invoice => invoice.selected)
      .reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0)
  }, [invoices])

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

    const discountAmount = subtotal * (globalDiscountPercent / 100)
    const discountedSubtotal = subtotal - discountAmount
    const taxAmount = discountedSubtotal * (taxPercent / 100)
    const total = discountedSubtotal + taxAmount
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
    fetchInvoices({ search: searchQuery, customerId: selectedCustomerId, page: 1 })
  }

  const canSearch =
    !!selectedWarehouse ||
    !!dateRange?.from ||
    !!searchQuery ||
    !!selectedCustomerId

  const DELETE_ERROR_MESSAGES: Record<string, string> = {
    INVENTORY_CONFLICT: "Could not return some products to the warehouse.",
    MISSING_WAREHOUSE: "This invoice has no warehouse, so stock cannot be restored.",
    RELATED_DATA: "This invoice cannot be deleted because related records still exist.",
    NOT_FOUND: "Invoice was not found.",
    DELETE_FAILED: "Invoice could not be deleted.",
  }

  const parseDeleteError = (body: Record<string, unknown>, fallbackStatus?: number): DeleteErrorPayload => {
    const code =
      typeof body.code === "string" && body.code
        ? body.code
        : fallbackStatus === 404
          ? "NOT_FOUND"
          : "DELETE_FAILED"
    const detail =
      (typeof body.detail === "string" && body.detail) ||
      (typeof body.message === "string" && body.message) ||
      (typeof body.error === "string" && body.error) ||
      "Invoice could not be deleted."
    const product_ids = Array.isArray(body.product_ids)
      ? body.product_ids.filter((id): id is number => typeof id === "number")
      : []
    const errors = Array.isArray(body.errors) ? body.errors : []
    return {
      code,
      message: DELETE_ERROR_MESSAGES[code] || detail,
      detail,
      product_ids,
      errors,
    }
  }

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete || deleteConfirmation !== "DELETE") return

    deleteAbortControllerRef.current?.abort()
    deleteAbortControllerRef.current = new AbortController()
    const signal = deleteAbortControllerRef.current.signal

    setLoadingAction({ id: invoiceToDelete.id, action: "delete" })
    setDeleteError(null)
    setShowDeleteErrorDetails(false)

    try {
      const res = await fetchWithRetry(`${API_URL}/sales/invoices/${invoiceToDelete.id}/delete/`, {
        method: "DELETE",
        headers,
        signal,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const parsed = parseDeleteError(errorData as Record<string, unknown>, res.status)
        setDeleteError(parsed)
        toast.error("Could not delete invoice", { description: parsed.message })
        return
      }

      setInvoices((prev) => prev.filter((i) => i.id !== invoiceToDelete.id))
      setTotalCount((prev) => Math.max(0, prev - 1))
      toast.success("Invoice Deleted", { description: "Invoice deleted and items returned to warehouse." })
      setInvoiceToDelete(null)
      setDeleteConfirmation("")
      setActiveDialog(null)
      setDeleteError(null)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
      const message = error instanceof Error ? error.message : "Failed to delete invoice"
      setDeleteError({
        code: "DELETE_FAILED",
        message: DELETE_ERROR_MESSAGES.DELETE_FAILED,
        detail: message,
        product_ids: [],
        errors: [message],
      })
      handleError(error, message, { title: "Error" })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleViewReceipt = async (invoice: Invoice) => {
    receiptAbortControllerRef.current?.abort()
    receiptAbortControllerRef.current = new AbortController()

    setLoadingAction({ id: invoice.id, action: "receipt" })
    setReceiptPayload(null)
    setActiveDialog('receipt')

    try {
      const res = await fetchWithRetry(
        `${API_URL}/sales/invoices/${invoice.id}/summary/`,
        { headers, signal: receiptAbortControllerRef.current.signal }
      )
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const data = await res.json()
      setReceiptPayload(buildReceiptPayloadFromSummary(data))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to load receipt")
      setActiveDialog(null)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleDeleteClick = (invoice: Invoice) => {
    setInvoiceToDelete(invoice)
    setDeleteError(null)
    setShowDeleteErrorDetails(false)
    setDeleteConfirmation("")
    setActiveDialog("delete")
  }

  const handleDeleteDialogClose = () => {
    setActiveDialog(null)
    setInvoiceToDelete(null)
    setDeleteConfirmation("")
    setDeleteError(null)
    setShowDeleteErrorDetails(false)
  }

  const handleReceiptClose = () => {
    receiptAbortControllerRef.current?.abort()
    setActiveDialog(null)
    setReceiptPayload(null)
  }

  return (
    <ErrorBoundary>
    <>
      <DocumentTitle title="Invoices" />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[DASHBOARD_CRUMB, { label: "Invoices" }]} />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <h2 className="text-xl font-semibold mb-4">Invoice Management</h2>
            <p className="mb-6">View and manage sales invoices.</p>

            <InvoiceFilters
              warehouses={warehouses}
              customers={customers}
              selectedWarehouse={selectedWarehouse}
              onWarehouseChange={setSelectedWarehouse}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              selectedCustomerId={selectedCustomerId}
              onCustomerChange={setSelectedCustomerId}
              isLoadingCustomers={isLoadingCustomers}
              onSearchFormSubmit={handleSearch}
              onSearchClick={() =>
                fetchInvoices({
                  search: searchQuery,
                  customerId: selectedCustomerId,
                  page: 1,
                })
              }
              onReset={handleResetFilters}
              canSearch={canSearch}
            />

            <InvoiceTable
              invoices={invoices}
              isLoading={isLoading}
              hasSearched={hasSearched}
              selectedTotal={selectedTotal}
              currentPage={currentPage}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={(page) =>
                fetchInvoices({
                  search: searchQuery,
                  customerId: selectedCustomerId,
                  page,
                })
              }
              onPageSizeChange={(size) =>
                fetchInvoices({
                  search: searchQuery,
                  customerId: selectedCustomerId,
                  page: 1,
                  pageSize: size,
                })
              }
              onSelectAll={handleSelectAll}
              onInvoiceSelect={handleInvoiceSelect}
              isRowLoading={isRowLoading}
              onViewInvoice={handleViewInvoice}
              onViewReceipt={handleViewReceipt}
              onExportExcel={handleExportInvoiceExcel}
              onDeleteClick={handleDeleteClick}
            />
          </div>
        </div>
      </SidebarInset>

      <InvoiceViewDialog
        open={activeDialog === 'view'}
        onOpenChange={(open) => setActiveDialog(open ? 'view' : null)}
        invoice={selectedInvoice}
        invoiceTotals={invoiceTotals}
        onClose={() => setActiveDialog(null)}
      />

      <InvoiceDeleteDialog
        open={activeDialog === 'delete'}
        onOpenChange={(open) => {
          setActiveDialog(open ? 'delete' : null)
          if (!open) {
            setDeleteError(null)
            setShowDeleteErrorDetails(false)
            setDeleteConfirmation("")
          }
        }}
        invoice={invoiceToDelete}
        deleteConfirmation={deleteConfirmation}
        onDeleteConfirmationChange={setDeleteConfirmation}
        deleteError={deleteError}
        showDeleteErrorDetails={showDeleteErrorDetails}
        onToggleDeleteErrorDetails={() => setShowDeleteErrorDetails((v) => !v)}
        isDeleting={invoiceToDelete != null && isRowLoading(invoiceToDelete.id, "delete")}
        onCancel={handleDeleteDialogClose}
        onDelete={handleDeleteInvoice}
      />

      <InvoiceReceiptDialog
        open={activeDialog === 'receipt'}
        onOpenChange={(open) => {
          if (!open) {
            handleReceiptClose()
          }
        }}
        receiptPayload={receiptPayload}
        isLoading={loadingAction?.action === "receipt" && !receiptPayload}
        onClose={handleReceiptClose}
      />
    </>
  </ErrorBoundary>
  )
}
