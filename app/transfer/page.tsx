"use client"

import { PageBreadcrumb, DASHBOARD_CRUMB } from "@/components/page-breadcrumb"
import { DocumentTitle } from "@/components/document-title"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { fetchWithRetry } from "@/lib/apiClient"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { MultiSelectProducts } from "@/components/multi-select-products"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { TableSkeleton } from "@/components/table-skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { API_URL } from "@/lib/config"

type Product = {
  id: number
  title_en?: string
  title_ar?: string
  name?: string
}

type TransferPreviewRow = {
  product_id: number
  product_name: string
  from_quantity: number
  to_quantity: number
}

type Warehouse = {
  id: number
  name_en?: string
  name?: string
}

type Inventory = {
  id: number
  quantity: number
  product: Product
  warehouse: Warehouse
  product_id?: number
  warehouse_id?: number
}

type TransferRow = {
  productId: number
  productName: string
  fromQuantity: number
  toQuantity: number
  transferQuantity: number
}

export default function ProductTransferPage() {
  const [mounted, setMounted] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [hasRequested, setHasRequested] = useState<boolean>(false)
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false)
  const [saveProgress, setSaveProgress] = useState<{
    mode: "bulk" | "individual" | null
    current: number
    total: number
    label: string
  }>({ mode: null, current: 0, total: 0, label: "" })

  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  
  // Loading states for async dropdowns
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false)
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState<boolean>(false)

  // Filter states
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [selectedProductLabels, setSelectedProductLabels] = useState<Record<number, string>>({})
  const [fromWarehouseId, setFromWarehouseId] = useState<number | null>(null)
  const [toWarehouseId, setToWarehouseId] = useState<number | null>(null)
  const [showAllSelected, setShowAllSelected] = useState(false)
  const MAX_VISIBLE_ITEMS = 3 // Show first 3 items by default

  // Transfer rows data
  const [transferRows, setTransferRows] = useState<TransferRow[]>([])
  const [transferQuantities, setTransferQuantities] = useState<Record<number, number>>({})

  // AbortController ref for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null)

  // Track access token in state to ensure headers update when token changes
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Update token when localStorage changes
  useEffect(() => {
    if (typeof window === "undefined") return

    const handleStorageChange = () => {
      const token = localStorage.getItem("accessToken")
      setAccessToken(token)
    }

    handleStorageChange()
    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [])

  // Memoized auth headers
  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken || ""}`,
    }),
    [accessToken]
  )

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

useEffect(() => {
    setMounted(true)
    
    if (typeof window === "undefined") return
    
    const checkAndFetch = () => {
      const token = localStorage.getItem("accessToken")
      if (token) {
        const abortController = new AbortController()
        abortControllerRef.current = abortController
        void fetchLookups(abortController.signal)
      } else {
        setTimeout(checkAndFetch, 100)
      }
    }
    
    checkAndFetch()
    
    return () => {
      // Only abort if request is still pending to reduce "Broken pipe" errors
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        try {
          abortControllerRef.current.abort()
        } catch (e) {
          // Ignore abort errors
        }
        abortControllerRef.current = null
      }
    }
  }, [])

  // Fetch products with server-side search
  const fetchProductsSearch = async (
    search: string = "",
    signal?: AbortSignal,
    options?: { trackLoading?: boolean },
  ): Promise<Product[]> => {
    const trackLoading = options?.trackLoading !== false
    if (trackLoading) setIsLoadingProducts(true)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      }
      
      const params = new URLSearchParams()
      params.append("page_size", "50")
      if (search.trim()) {
        params.append("search", search.trim())
      }
      
      const res = await fetchWithRetry(`${API_URL}/inventory/product-summary/?${params.toString()}`, {
        headers, 
        signal: signal || abortControllerRef.current?.signal 
      })
      
      const ensureJson = async (res: Response) => {
        const ct = res.headers.get("content-type") || ""
        if (!ct.includes("application/json")) {
          const text = await res.text()
          throw new Error(`Products request failed (${res.status}): ${text.slice(0, 200)}`)
        }
        return res.json()
      }
      
      const data = await ensureJson(res)
      const normalizeList = (payload: any) => {
        if (!payload) return []
        if (Array.isArray(payload)) return payload
        if (Array.isArray(payload.results)) return payload.results
        if (Array.isArray(payload.data)) return payload.data
        if (Array.isArray(payload.items)) return payload.items
        return []
      }
      
      return normalizeList(data)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        return []
      }
      if (process.env.NODE_ENV !== "production") {
        console.error("Products search failed", e)
      }
      return []
    } finally {
      if (trackLoading) setIsLoadingProducts(false)
    }
  }

  // Fetch warehouses with server-side search
  const fetchWarehousesSearch = async (search: string = "", signal?: AbortSignal): Promise<Warehouse[]> => {
    setIsLoadingWarehouses(true)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      }
      
      const params = new URLSearchParams()
      params.append("page_size", "50")
      if (search.trim()) {
        params.append("search", search.trim())
      }
      
      const res = await fetchWithRetry(`${API_URL}/inventory/warehouses/?${params.toString()}`, { 
        headers, 
        signal: signal || abortControllerRef.current?.signal 
      })
      
      const ensureJson = async (res: Response) => {
        const ct = res.headers.get("content-type") || ""
        if (!ct.includes("application/json")) {
          const text = await res.text()
          throw new Error(`Warehouses request failed (${res.status}): ${text.slice(0, 200)}`)
        }
        return res.json()
      }
      
      const data = await ensureJson(res)
      const normalizeList = (payload: any) => {
        if (!payload) return []
        if (Array.isArray(payload)) return payload
        if (Array.isArray(payload.results)) return payload.results
        if (Array.isArray(payload.data)) return payload.data
        if (Array.isArray(payload.items)) return payload.items
        return []
      }
      
      return normalizeList(data)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        return []
      }
      if (process.env.NODE_ENV !== "production") {
        console.error("Warehouses search failed", e)
      }
      return []
    } finally {
      setIsLoadingWarehouses(false)
    }
  }

  const fetchLookups = async (signal?: AbortSignal) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
      if (!token) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("No access token available for fetchLookups")
        }
        toast.error("Error", { description: "Authentication required. Please log in again." })
        return
      }
      
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
      
      const wRes = await fetchWithRetry(
        `${API_URL}/inventory/warehouses/?page_size=100`,
        { headers, signal: signal || abortControllerRef.current?.signal },
      )
      
      const ensureJson = async (res: Response) => {
        const ct = res.headers.get("content-type") || ""
        if (!ct.includes("application/json")) {
          const text = await res.text()
          throw new Error(`Lookup request failed (${res.status}): ${text.slice(0, 200)}`)
        }
        return res.json()
      }
      
      const wData = await ensureJson(wRes)
      const normalizeList = (payload: any) => {
        if (!payload) return []
        if (Array.isArray(payload)) return payload
        if (Array.isArray(payload.results)) return payload.results
        if (Array.isArray(payload.data)) return payload.data
        if (Array.isArray(payload.items)) return payload.items
        return []
      }
      
      setWarehouses(normalizeList(wData))
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        return
      }
      if (process.env.NODE_ENV !== "production") {
      console.error("Lookup fetch failed", e)
      }
      toast.error("Error", { description: "Failed to load warehouses" })
    }
  }

  // Fetch inventory data for selected products and warehouses
  const fetchTransferData = async () => {
    if (!fromWarehouseId || !toWarehouseId || selectedProductIds.length === 0) {
      return
    }

    // Validate warehouses are different
    if (fromWarehouseId === toWarehouseId) {
      toast.error("Error", { description: "From and To warehouses must be different" })
        return
    }

    setIsLoading(true)
    setHasRequested(true)
    
    try {
      const params = new URLSearchParams()
      selectedProductIds.forEach((productId) => {
        params.append("product_id", String(productId))
      })
      params.append("from_warehouse_id", String(fromWarehouseId))
      params.append("to_warehouse_id", String(toWarehouseId))

      const response = await fetchWithRetry(
        `${API_URL}/inventory/transfer-preview/?${params.toString()}`,
        { headers: authHeaders, signal: abortControllerRef.current?.signal },
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText.slice(0, 200) || "Failed to load transfer preview")
      }

      const data = await response.json()
      const previewRows: TransferPreviewRow[] = Array.isArray(data.results) ? data.results : []

      const rows: TransferRow[] = previewRows.map((row) => ({
        productId: row.product_id,
        productName: row.product_name,
        fromQuantity: row.from_quantity ?? 0,
        toQuantity: row.to_quantity ?? 0,
        transferQuantity: transferQuantities[row.product_id] || 0,
      }))

      setSelectedProductLabels((prev) => {
        const next = { ...prev }
        for (const row of rows) {
          next[row.productId] = row.productName
        }
        return next
      })
      
      setTransferRows(rows)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        return
      }
      if (process.env.NODE_ENV !== "production") {
        console.error("Fetch transfer data failed", e)
      }
      toast.error("Error", { description: "Failed to load inventory data" })
      setTransferRows([])
    } finally {
      setIsLoading(false)
    }
  }

  // Handle search button click
  const handleSearch = () => {
    if (selectedProductIds.length === 0) {
      toast.error("Error", { description: "Please select at least one product" })
        return
    }
    
    if (!fromWarehouseId) {
      toast.error("Error", { description: "Please select From warehouse" })
      return
    }
    
    if (!toWarehouseId) {
      toast.error("Error", { description: "Please select To warehouse" })
      return
    }
    
    if (fromWarehouseId === toWarehouseId) {
      toast.error("Error", { description: "From and To warehouses must be different" })
        return
    }
    
    void fetchTransferData()
  }

  // Handle reset button click
  const handleReset = () => {
    setSelectedProductIds([])
    setSelectedProductLabels({})
    setFromWarehouseId(null)
    setToWarehouseId(null)
    setTransferRows([])
    setTransferQuantities({})
    setHasRequested(false)
  }

  // Handle transfer quantity change
  const handleTransferQuantityChange = (productId: number, value: number) => {
    const row = transferRows.find(r => r.productId === productId)
    if (!row) return
    
    const numValue = Number(value) || 0
    
    // Validate: transfer quantity must be <= from quantity
    if (numValue > row.fromQuantity) {
      toast.error("Error", { description: "Transfer quantity cannot exceed available quantity (${row.fromQuantity})" })
        return
    }
    
    setTransferQuantities(prev => ({ ...prev, [productId]: numValue }))
    setTransferRows(prev => prev.map(r => 
      r.productId === productId ? { ...r, transferQuantity: numValue } : r
    ))
  }

  // Save all transfers — prefer bulk endpoint; fall back to per-item with progress
  const handleSaveAll = async () => {
    if (!fromWarehouseId || !toWarehouseId || transferRows.length === 0) {
      return
    }

    const invalidRows = transferRows.filter((row) => {
      const transferQty = transferQuantities[row.productId] || 0
      return transferQty > 0 && transferQty > row.fromQuantity
    })

    if (invalidRows.length > 0) {
      toast.error("Error", { description: "Some transfer quantities exceed available inventory" })
      return
    }

    const rowsToTransfer = transferRows.filter((row) => {
      const transferQty = transferQuantities[row.productId] || 0
      return transferQty > 0
    })

    if (rowsToTransfer.length === 0) {
      toast.error("Error", { description: "Please enter transfer quantities" })
      return
    }

    const transfers = rowsToTransfer.map((row) => ({
      product_id: row.productId,
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      quantity: transferQuantities[row.productId] || 0,
      shipping_cost: 0,
      transfer_date: new Date().toISOString().split("T")[0],
    }))

    const total = transfers.length
    setIsSavingAll(true)
    setSaveProgress({
      mode: "bulk",
      current: 0,
      total,
      label: `Bulk transfer: preparing ${total} item${total === 1 ? "" : "s"}…`,
    })

    const runIndividualFallback = async (reason: string) => {
      setSaveProgress({
        mode: "individual",
        current: 0,
        total,
        label: `Individual transfer (fallback): 0 of ${total}`,
      })
      toast.success("Using individual transfers", { description: "${reason} Falling back to one request per product." })

      let successCount = 0
      let failedCount = 0
      const errorMessages: string[] = []

      for (let i = 0; i < transfers.length; i++) {
        const transfer = transfers[i]
        setSaveProgress({
          mode: "individual",
          current: i,
          total,
          label: `Individual transfer (fallback): ${i} of ${total}`,
        })

        try {
          const transferPayload = {
            product: transfer.product_id,
            from_warehouse: transfer.from_warehouse_id,
            to_warehouse: transfer.to_warehouse_id,
            quantity: transfer.quantity,
            shipping_cost: 0,
            transfer_date: transfer.transfer_date,
          }

          const res = await fetchWithRetry(`${API_URL}/inventory/transfers/`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(transferPayload),
            signal: abortControllerRef.current?.signal,
          })

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ detail: "Unknown error" }))
            throw new Error(
              typeof errorData.detail === "string"
                ? errorData.detail
                : JSON.stringify(errorData.detail || errorData) || `Transfer failed (${res.status})`,
            )
          }
          successCount += 1
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") throw err
          failedCount += 1
          errorMessages.push(err instanceof Error ? err.message : "Unknown error")
        }

        setSaveProgress({
          mode: "individual",
          current: i + 1,
          total,
          label: `Individual transfer (fallback): ${i + 1} of ${total}`,
        })
      }

      return { successCount, failedCount, errorMessages, mode: "individual" as const }
    }

    try {
      let successCount = 0
      let failedCount = 0
      let mode: "bulk" | "individual" = "bulk"
      let errorMessages: string[] = []

      setSaveProgress({
        mode: "bulk",
        current: Math.max(1, Math.floor(total * 0.3)),
        total,
        label: `Bulk transfer: sending ${total} item${total === 1 ? "" : "s"}…`,
      })

      let useBulk = true
      try {
        const res = await fetchWithRetry(`${API_URL}/inventory/transfers/bulk/`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ transfers }),
          signal: abortControllerRef.current?.signal,
        })

        if (res.status === 404) {
          useBulk = false
        } else if (res.status === 201 || res.status === 207 || res.ok) {
          const ct = res.headers.get("content-type") || ""
          if (ct.includes("application/json")) {
            const data = await res.json()
            const succeeded = Array.isArray(data.succeeded) ? data.succeeded : []
            const failedRows = Array.isArray(data.failed) ? data.failed : []
            successCount =
              typeof data.success_count === "number"
                ? data.success_count
                : succeeded.length || total
            failedCount =
              typeof data.failed_count === "number" ? data.failed_count : failedRows.length
            if (failedRows.length) {
              errorMessages = failedRows.map(
                (row: { id?: number | null; reason?: string; index?: number }, idx: number) => {
                  const label =
                    row.id != null
                      ? `Product ${row.id}`
                      : typeof row.index === "number"
                        ? `Item ${row.index + 1}`
                        : `Item ${idx + 1}`
                  return `${label}: ${row.reason || "Unknown error"}`
                },
              )
            } else if (Array.isArray(data.errors) && data.errors.length) {
              // Legacy shape fallback
              errorMessages = data.errors.map(
                (err: { index?: number; errors?: unknown }, idx: number) => {
                  const n = typeof err?.index === "number" ? err.index + 1 : idx + 1
                  return `Item ${n}: ${JSON.stringify(err.errors ?? err)}`
                },
              )
            }
          } else {
            successCount = total
            failedCount = 0
          }
          mode = "bulk"
          setSaveProgress({
            mode: "bulk",
            current: total,
            total,
            label: `Bulk transfer: ${successCount} of ${total} completed`,
          })
        } else {
          // All-failed bulk responses often return 400 with succeeded/failed body
          const ct = res.headers.get("content-type") || ""
          if (ct.includes("application/json")) {
            const data = await res.json().catch(() => null)
            if (data && (Array.isArray(data.failed) || Array.isArray(data.succeeded))) {
              const succeeded = Array.isArray(data.succeeded) ? data.succeeded : []
              const failedRows = Array.isArray(data.failed) ? data.failed : []
              successCount =
                typeof data.success_count === "number" ? data.success_count : succeeded.length
              failedCount =
                typeof data.failed_count === "number" ? data.failed_count : failedRows.length
              errorMessages = failedRows.map(
                (row: { id?: number | null; reason?: string }, idx: number) =>
                  `${row.id != null ? `Product ${row.id}` : `Item ${idx + 1}`}: ${row.reason || "Unknown error"}`,
              )
              mode = "bulk"
              setSaveProgress({
                mode: "bulk",
                current: total,
                total,
                label: `Bulk transfer: ${successCount} of ${total} completed`,
              })
            } else {
              const errorMessage =
                (data && (data.detail || data.message)) || `Bulk transfer failed (${res.status})`
              throw new Error(
                typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage),
              )
            }
          } else {
          const text = await res.text().catch(() => "")
          let errorMessage = `Bulk transfer failed (${res.status})`
          try {
            const errorData = JSON.parse(text)
            errorMessage = errorData.detail || errorData.message || errorMessage
            if (errorData.errors) {
              errorMessage += `: ${JSON.stringify(errorData.errors)}`
            }
          } catch {
            if (text) errorMessage += `: ${text.slice(0, 200)}`
          }
          throw new Error(errorMessage)
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") throw e
        const isMissingEndpoint =
          e instanceof Error &&
          (e.message.includes("404") || e.message.toLowerCase().includes("not found"))
        const isNetwork =
          e instanceof TypeError ||
          (e instanceof Error && /failed to fetch|network/i.test(e.message))

        if (isMissingEndpoint || isNetwork) {
          useBulk = false
        } else {
          throw e
        }
      }

      if (!useBulk) {
        const result = await runIndividualFallback(
          "Bulk endpoint unavailable (404) or unreachable.",
        )
        successCount = result.successCount
        failedCount = result.failedCount
        errorMessages = result.errorMessages
        mode = "individual"
      }

      if (failedCount > 0) {
        toast.error(mode === "bulk" ? `Bulk transfer: ${successCount} of ${total}` : `Individual transfer (fallback): ${successCount} of ${total}`, { description: "${failedCount} failed." })
      } else {
        toast.success("Transfer complete", {
          description:
            mode === "bulk"
              ? `Moved ${successCount} item${successCount === 1 ? "" : "s"} between warehouses`
              : `Moved ${successCount} item${successCount === 1 ? "" : "s"} (one request per product)`,
          duration: 4500,
        })
      }

      await fetchTransferData()
      setTransferQuantities({})
      setTransferRows((prev) => prev.map((r) => ({ ...r, transferQuantity: 0 })))
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return
      }
      const msg = e instanceof Error ? e.message : "Failed to save transfers"
      toast.error("Error", { description: msg })
    } finally {
      setIsSavingAll(false)
      setSaveProgress({ mode: null, current: 0, total: 0, label: "" })
    }
  }

  const getProductDisplayName = useCallback((product: Product) => {
    return product.title_en || product.title_ar || product.name || String(product.id)
  }, [])

  const selectedProductOptions = useMemo(
    () =>
      selectedProductIds.map((id) => ({
        id,
        name: selectedProductLabels[id] || getProductDisplayName(products.find((p) => p.id === id) || { id }),
      })),
    [selectedProductIds, selectedProductLabels, products, getProductDisplayName],
  )

  // Memoized warehouse options
  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ id: w.id, name: w.name_en || (w as any).name || String(w.id) })),
    [warehouses]
  )

  // Helper functions for async dropdowns
  const fetchProductsForDropdown = useCallback(async (search: string, signal?: AbortSignal): Promise<{ id: number; name: string }[]> => {
    try {
      // Ensure we have a fresh token
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
      if (!token) {
        toast.error("Error", { description: "Authentication required. Please log in again." })
        return []
      }
      
      const fetchedProducts = await fetchProductsSearch(search, signal, { trackLoading: false })
      setProducts((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]))
        for (const product of fetchedProducts) {
          byId.set(product.id, product)
        }
        return [...byId.values()]
      })
      return fetchedProducts.map((p: Product) => ({
        id: p.id,
        name: getProductDisplayName(p),
      }))
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to fetch products for dropdown:", e)
      }
      return []
    }
  }, [getProductDisplayName])

  const fetchWarehousesForDropdown = useCallback(async (search: string, signal?: AbortSignal): Promise<{ id: number; name: string }[]> => {
    try {
      // Ensure we have a fresh token
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
      if (!token) {
        toast.error("Error", { description: "Authentication required. Please log in again." })
        return []
      }
      
      const warehouses = await fetchWarehousesSearch(search, signal)
      return warehouses.map((w: Warehouse) => ({
        id: w.id,
        name: w.name_en || (w as any).name || String(w.id)
      }))
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to fetch warehouses for dropdown:", e)
      }
      return []
    }
  }, [])

  // Get warehouse name
  const getWarehouseName = (id?: number | null) => {
    if (id === undefined || id === null) return undefined
    const w = warehouses.find(wh => wh.id === id)
    return w?.name_en || (w as any)?.name || undefined
  }

  // Simple SearchableCombobox for warehouses (like inventory page)
  const WarehouseSearchableCombobox = ({
    value,
    onChange,
    placeholder,
    items,
    onOpen,
  }: {
    value: number | null
    onChange: (val: number | null) => void
    placeholder: string
    items: { id: number; name: string }[]
    onOpen?: () => void
  }) => {
    const [open, setOpen] = useState(false)
    const currentLabel = value ? items.find((i) => i.id === value)?.name : undefined
    return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next && onOpen) onOpen()
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="justify-between w-full">
            {currentLabel || placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[280px]">
          <Command>
            <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {items.map((it) => (
                  <CommandItem
                    key={it.id}
                    value={String(it.id)}
                    onSelect={(v) => {
                      const selectedId = Number(v)
                      if (!isNaN(selectedId)) {
                        onChange(selectedId)
                        setOpen(false)
                      }
                    }}
                  >
                    {it.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  const handleProductSelected = useCallback((id: number, name: string) => {
    setSelectedProductLabels((prev) => ({ ...prev, [id]: name }))
  }, [])

  // Helper to get warehouse name async
  const getWarehouseNameAsync = useCallback(async (id: number): Promise<string | undefined> => {
    // First check cache
    const w = warehouses.find(wh => wh.id === id)
    if (w) {
      return w.name_en || (w as any).name || undefined
    }
    
    // If not in cache, fetch it with auth
    try {
      // Ensure we have a fresh token
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
      if (!token) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("No access token available for getWarehouseNameAsync")
        }
        return undefined
      }
      
      const items = await fetchWarehousesSearch("", abortControllerRef.current?.signal)
      const found = items.find((w: Warehouse) => w.id === id)
      if (found) {
        return found.name_en || (found as any).name || undefined
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to fetch warehouse name:", e)
      }
    }
    return undefined
  }, [warehouses])

  // Early return for mounting
  if (!mounted) {
    return null
  }

  return (
    <ErrorBoundary>
      <DocumentTitle title="Transfer" />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[DASHBOARD_CRUMB, { label: "Product Transfer" }]} />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Product Transfer</h2>
                <p className="text-sm text-muted-foreground">Transfer products between warehouses.</p>
                      </div>

              <div className="border rounded-md">
                {/* Search Section */}
                <div className="bg-muted p-4">
                  <div className="grid gap-4 md:grid-cols-4 md:gap-4">
                          <div className="grid gap-2">
                      <Label>Products (Multi-select)</Label>
                      <MultiSelectProducts
                        selectedIds={selectedProductIds}
                        onSelectionChange={setSelectedProductIds}
                        fetchItems={fetchProductsForDropdown}
                        selectedLabels={selectedProductLabels}
                        onProductSelected={handleProductSelected}
                        placeholder="Select products..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>From Warehouse</Label>
                      <WarehouseSearchableCombobox
                        value={fromWarehouseId}
                        onChange={(val) => {
                          setFromWarehouseId(val)
                          // Clear transfer rows when warehouse changes
                          if (val !== fromWarehouseId) {
                            setTransferRows([])
                            setTransferQuantities({})
                            setHasRequested(false)
                          }
                        }}
                        placeholder="Select from warehouse"
                        items={warehouseOptions}
                        onOpen={() => {
                          // Ensure warehouses are loaded when dropdown opens
                          if (warehouses.length === 0) {
                            void fetchLookups()
                          }
                        }}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>To Warehouse</Label>
                      <WarehouseSearchableCombobox
                        value={toWarehouseId}
                        onChange={(val) => {
                          setToWarehouseId(val)
                          // Clear transfer rows when warehouse changes
                          if (val !== toWarehouseId) {
                            setTransferRows([])
                            setTransferQuantities({})
                            setHasRequested(false)
                          }
                        }}
                        placeholder="Select to warehouse"
                        items={warehouseOptions}
                        onOpen={() => {
                          // Ensure warehouses are loaded when dropdown opens
                          if (warehouses.length === 0) {
                            void fetchLookups()
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-2 items-end">
                    <Button 
                        disabled={isSavingAll || isLoading} 
                        onClick={handleSearch}
                      >
                        Search
                    </Button>
                    <Button 
                        variant="outline" 
                        disabled={isSavingAll} 
                        onClick={handleReset}
                      >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>

              {/* Selected Products Section - Only show when products are selected */}
              {selectedProductIds.length > 0 && (
                <div className="border-t bg-background px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">
                      Selected Products ({selectedProductIds.length})
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setSelectedProductIds([])
                        setSelectedProductLabels({})
                      }}
                    >
                      Deselect All
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(showAllSelected ? selectedProductOptions : selectedProductOptions.slice(0, MAX_VISIBLE_ITEMS)).map((item) => (
                      <Badge key={item.id} variant="secondary" className="flex items-center gap-1">
                        <span className="max-w-[200px] truncate">{item.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedProductIds(prev => prev.filter(id => id !== item.id))}
                          className="ml-1 rounded-full hover:bg-secondary-foreground/20 p-0.5 flex-shrink-0"
                          aria-label={`Remove ${item.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  {selectedProductIds.length > MAX_VISIBLE_ITEMS && (
                    <button
                      type="button"
                      onClick={() => setShowAllSelected(!showAllSelected)}
                      className="text-sm text-primary hover:underline font-medium mt-2"
                    >
                      {showAllSelected 
                        ? `Show less (${selectedProductIds.length - MAX_VISIBLE_ITEMS} hidden)` 
                        : `Show ${selectedProductIds.length - MAX_VISIBLE_ITEMS} more`}
                    </button>
                  )}
                </div>
              )}

                {/* Save All Changes Section */}
              {hasRequested && (
                <div className="border-t bg-background px-4 py-3 space-y-3">
                  {isSavingAll && saveProgress.mode && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                        <span>{saveProgress.label}</span>
                        <span>
                          {saveProgress.total > 0
                            ? `${Math.min(saveProgress.current, saveProgress.total)}/${saveProgress.total}`
                            : ""}
                        </span>
                      </div>
                      <Progress
                        value={
                          saveProgress.total > 0
                            ? Math.round((saveProgress.current / saveProgress.total) * 100)
                            : 10
                        }
                      />
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button
                      variant="default"
                      disabled={isLoading || isSavingAll}
                      onClick={() => void handleSaveAll()}
                    >
                      {isSavingAll ? "Transferring..." : "Save All Changes"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Results Grid */}
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Products</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Transfer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!hasRequested ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          Select products and warehouses, then click Search to load data
                        </TableCell>
                      </TableRow>
                    ) : isLoading ? (
                      <TableSkeleton columns={4} rows={5} />
                    ) : transferRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center">
                          No products selected
                        </TableCell>
                      </TableRow>
                    ) : (
                      transferRows.map((row) => {
                        const transferQty = transferQuantities[row.productId] || 0
                        const isValid = transferQty <= row.fromQuantity
                        const fromWarehouseName = getWarehouseName(fromWarehouseId) || `Warehouse ${fromWarehouseId}`
                        const toWarehouseName = getWarehouseName(toWarehouseId) || `Warehouse ${toWarehouseId}`
                        
                        return (
                          <TableRow key={row.productId}>
                            <TableCell className="font-medium">{row.productName}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{row.fromQuantity}</span>
                                <span className="text-xs text-muted-foreground">{fromWarehouseName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{row.toQuantity}</span>
                                <span className="text-xs text-muted-foreground">{toWarehouseName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                className={`h-8 w-24 ${!isValid && transferQty > 0 ? 'border-destructive' : ''}`}
                                value={transferQty}
                                onChange={(e) => handleTransferQuantityChange(row.productId, Number(e.target.value || 0))}
                                min="0"
                                max={row.fromQuantity}
                                step="1"
                                placeholder="0"
                              />
                              {!isValid && transferQty > 0 && (
                                <p className="text-xs text-destructive mt-1">
                                  Max: {row.fromQuantity}
                                </p>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
</ErrorBoundary>
  )
}
