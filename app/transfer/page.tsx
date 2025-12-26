"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Checkbox } from "@/components/ui/checkbox"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"

type Product = {
  id: number
  title_en?: string
  name?: string
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

// Use the same API base as login page
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

export default function ProductTransferPage() {
  const [mounted, setMounted] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [hasRequested, setHasRequested] = useState<boolean>(false)
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false)

  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  
  // Loading states for async dropdowns
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false)
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState<boolean>(false)

  // Filter states
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
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

  // Exponential backoff retry utility
  const fetchWithRetry = useCallback(async (
    url: string,
    options: RequestInit = {},
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<Response> => {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (options.signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError')
        }
        
        const response = await fetch(url, options)
        
        if (response.ok) {
          return response
        }
        
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return response
        }
        
        if (response.status >= 500 || response.status === 429) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`)
        }
        
        return response
      } catch (error) {
        lastError = error as Error
        
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error
        }
        
        if (attempt === maxRetries) {
          break
        }
        
        const delay = baseDelay * Math.pow(2, attempt)
        
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(resolve, delay)
          
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId)
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            })
          }
        })
      }
    }
    
    throw lastError || new Error('Request failed after retries')
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
  const fetchProductsSearch = async (search: string = "", signal?: AbortSignal): Promise<Product[]> => {
    setIsLoadingProducts(true)
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
      
      const res = await fetchWithRetry(`${API_URL}/inventory/products/?${params.toString()}`, { 
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
      setIsLoadingProducts(false)
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

  const fetchLookups = async (signal?: AbortSignal, forceRefresh: boolean = false) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
      if (!token) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("No access token available for fetchLookups")
        }
        toast({ title: "Error", description: "Authentication required. Please log in again.", variant: "destructive" })
        return
      }
      
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
      
      const [pRes, wRes] = await Promise.all([
        fetchWithRetry(`${API_URL}/inventory/products/?page_size=1000`, { headers, signal: signal || abortControllerRef.current?.signal }),
        fetchWithRetry(`${API_URL}/inventory/warehouses/?page_size=1000`, { headers, signal: signal || abortControllerRef.current?.signal }),
      ])
      
      const ensureJson = async (res: Response) => {
        const ct = res.headers.get("content-type") || ""
        if (!ct.includes("application/json")) {
          const text = await res.text()
          throw new Error(`Lookup request failed (${res.status}): ${text.slice(0, 200)}`)
        }
        return res.json()
      }
      
      const [pData, wData] = await Promise.all([ensureJson(pRes), ensureJson(wRes)])
      const normalizeList = (payload: any) => {
        if (!payload) return []
        if (Array.isArray(payload)) return payload
        if (Array.isArray(payload.results)) return payload.results
        if (Array.isArray(payload.data)) return payload.data
        if (Array.isArray(payload.items)) return payload.items
        return []
      }
      
      const pList = normalizeList(pData)
      const wList = normalizeList(wData)
      
      setProducts(pList)
      setWarehouses(wList)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        return
      }
      if (process.env.NODE_ENV !== "production") {
      console.error("Lookup fetch failed", e)
      }
      toast({ title: "Error", description: "Failed to load products/warehouses", variant: "destructive" })
    }
  }

  // Fetch inventory data for selected products and warehouses
  const fetchTransferData = async () => {
    if (!fromWarehouseId || !toWarehouseId || selectedProductIds.length === 0) {
      return
    }

    // Validate warehouses are different
    if (fromWarehouseId === toWarehouseId) {
      toast({ 
        title: "Error", 
        description: "From and To warehouses must be different", 
        variant: "destructive" 
      })
        return
    }

    setIsLoading(true)
    setHasRequested(true)
    
    try {
      const rows: TransferRow[] = []
      
      // Fetch inventory for each product in both warehouses
      for (const productId of selectedProductIds) {
        const product = products.find(p => p.id === productId)
        const productName = product?.title_en || product?.name || `Product ${productId}`
        
        // Fetch from warehouse inventory
        let fromQuantity = 0
        try {
          const fromRes = await fetchWithRetry(
            `${API_URL}/inventory/inventory/?product_id=${productId}&warehouse_id=${fromWarehouseId}`,
            { headers: authHeaders, signal: abortControllerRef.current?.signal }
          )
          if (fromRes.ok) {
            const fromData = await fromRes.json()
            const fromList = fromData?.results ?? fromData ?? []
            const fromInv = Array.isArray(fromList) ? fromList[0] : null
            fromQuantity = fromInv?.quantity || 0
          }
        } catch (e) {
          if (process.env.NODE_ENV !== "production") {
            console.error(`Failed to fetch from warehouse inventory for product ${productId}:`, e)
          }
        }
        
        // Fetch to warehouse inventory
        let toQuantity = 0
        try {
          const toRes = await fetchWithRetry(
            `${API_URL}/inventory/inventory/?product_id=${productId}&warehouse_id=${toWarehouseId}`,
            { headers: authHeaders, signal: abortControllerRef.current?.signal }
          )
          if (toRes.ok) {
            const toData = await toRes.json()
            const toList = toData?.results ?? toData ?? []
            const toInv = Array.isArray(toList) ? toList[0] : null
            toQuantity = toInv?.quantity || 0
          }
        } catch (e) {
          if (process.env.NODE_ENV !== "production") {
            console.error(`Failed to fetch to warehouse inventory for product ${productId}:`, e)
          }
        }
        
        rows.push({
          productId,
          productName,
          fromQuantity,
          toQuantity,
          transferQuantity: transferQuantities[productId] || 0,
        })
      }
      
      setTransferRows(rows)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        return
      }
      if (process.env.NODE_ENV !== "production") {
        console.error("Fetch transfer data failed", e)
      }
      toast({ title: "Error", description: "Failed to load inventory data", variant: "destructive" })
      setTransferRows([])
    } finally {
      setIsLoading(false)
    }
  }

  // Handle search button click
  const handleSearch = () => {
    if (selectedProductIds.length === 0) {
      toast({ title: "Error", description: "Please select at least one product", variant: "destructive" })
        return
    }
    
    if (!fromWarehouseId) {
      toast({ title: "Error", description: "Please select From warehouse", variant: "destructive" })
      return
    }
    
    if (!toWarehouseId) {
      toast({ title: "Error", description: "Please select To warehouse", variant: "destructive" })
      return
    }
    
    if (fromWarehouseId === toWarehouseId) {
      toast({ title: "Error", description: "From and To warehouses must be different", variant: "destructive" })
        return
    }
    
    void fetchTransferData()
  }

  // Handle reset button click
  const handleReset = () => {
    setSelectedProductIds([])
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
      toast({ 
        title: "Error", 
        description: `Transfer quantity cannot exceed available quantity (${row.fromQuantity})`, 
        variant: "destructive" 
      })
        return
    }
    
    setTransferQuantities(prev => ({ ...prev, [productId]: numValue }))
    setTransferRows(prev => prev.map(r => 
      r.productId === productId ? { ...r, transferQuantity: numValue } : r
    ))
  }

  // Save all transfers
  const handleSaveAll = async () => {
    if (!fromWarehouseId || !toWarehouseId || transferRows.length === 0) {
      return
    }

    // Validate all transfer quantities
    const invalidRows = transferRows.filter(row => {
      const transferQty = transferQuantities[row.productId] || 0
      return transferQty > 0 && transferQty > row.fromQuantity
    })

    if (invalidRows.length > 0) {
      toast({ 
        title: "Error", 
        description: "Some transfer quantities exceed available inventory", 
        variant: "destructive" 
      })
      return
    }

    // Filter rows with transfer quantity > 0
    const rowsToTransfer = transferRows.filter(row => {
      const transferQty = transferQuantities[row.productId] || 0
      return transferQty > 0
    })

    if (rowsToTransfer.length === 0) {
      toast({ title: "Error", description: "Please enter transfer quantities", variant: "destructive" })
      return
    }

    setIsSavingAll(true)
    
    try {
      // Prepare bulk transfer data
      const transfers = rowsToTransfer.map(row => ({
        product_id: row.productId,
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        quantity: transferQuantities[row.productId] || 0,
      }))

      let successCount = 0
      let failedCount = 0
      let useBulk = true

      // Try bulk transfer API first
      try {
        const res = await fetchWithRetry(`${API_URL}/inventory/transfers/bulk/`, {
        method: "POST",
        headers: authHeaders,
          body: JSON.stringify({ transfers }),
        signal: abortControllerRef.current?.signal
      })

        // Check for 404 first (endpoint doesn't exist)
        if (res.status === 404) {
          // Bulk endpoint doesn't exist, fall back to individual transfers
          useBulk = false
        } else if (res.ok) {
          const ct = res.headers.get("content-type") || ""
          if (ct.includes("application/json")) {
            const data = await res.json()
            successCount = data.success_count || rowsToTransfer.length
            failedCount = data.failed_count || 0
          } else {
            // Non-JSON response but OK status
            successCount = rowsToTransfer.length
            failedCount = 0
          }
        } else {
          // Other error status - read error message but don't throw yet
          const text = await res.text().catch(() => "")
          let errorMessage = `Bulk transfer failed (${res.status})`
          try {
            const errorData = JSON.parse(text)
          errorMessage = errorData.detail || errorData.message || errorMessage
          if (errorData.errors) {
            errorMessage += `: ${JSON.stringify(errorData.errors)}`
          }
        } catch {
            if (text) {
              errorMessage += `: ${text.slice(0, 200)}`
            }
        }
        throw new Error(errorMessage)
      }
      } catch (e) {
        // Check if it's a 404 error (endpoint doesn't exist)
        if (e instanceof Error && (e.message.includes('404') || e.message.includes('Not Found'))) {
          useBulk = false
        } else if (e instanceof TypeError && e.message.includes('fetch')) {
          // Network error, try fallback
          useBulk = false
        } else {
          // Re-throw other errors
          throw e
        }
      }

      // Fallback to individual transfers if bulk endpoint doesn't exist
      if (!useBulk) {
        const results = await Promise.allSettled(
          transfers.map(async (transfer) => {
            // Create transfer record
            const transferPayload = {
              product: transfer.product_id,
              from_warehouse: transfer.from_warehouse_id,
              to_warehouse: transfer.to_warehouse_id,
              quantity: transfer.quantity,
              shipping_cost: 0,
              transfer_date: new Date().toISOString().split('T')[0],
            }

            const res = await fetchWithRetry(`${API_URL}/inventory/transfers/`, {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify(transferPayload),
        signal: abortControllerRef.current?.signal
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: "Unknown error" }))
              throw new Error(errorData.detail || `Transfer failed (${res.status})`)
            }

            return await res.json()
          })
        )

        successCount = results.filter(r => r.status === 'fulfilled').length
        failedCount = results.filter(r => r.status === 'rejected').length

        if (failedCount > 0) {
          const errors = results
            .filter(r => r.status === 'rejected')
            .map(r => r.status === 'rejected' ? r.reason?.message || 'Unknown error' : '')
            .join(', ')
          
          if (process.env.NODE_ENV !== "production") {
            console.error("Transfer errors:", errors)
          }
        }
      }

      if (failedCount > 0) {
        toast({ 
          title: "Partial Success", 
          description: `Transferred ${successCount} products. ${failedCount} failed.`,
          variant: "destructive"
        })
      } else {
        toast({ 
          title: "Success", 
          description: `Successfully transferred ${successCount} product${successCount === 1 ? '' : 's'}` 
        })
      }

      // Refresh data
      await fetchTransferData()
      
      // Clear transfer quantities
      setTransferQuantities({})
      setTransferRows(prev => prev.map(r => ({ ...r, transferQuantity: 0 })))
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setIsSavingAll(false)
        return
      }
      const msg = e instanceof Error ? e.message : "Failed to save transfers"
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setIsSavingAll(false)
    }
  }

  // Memoized product options
  const productOptions = useMemo(
    () => products.map((p) => ({ id: p.id, name: p.title_en || (p as any).name || String(p.id) })),
    [products]
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
        toast({ title: "Error", description: "Authentication required. Please log in again.", variant: "destructive" })
        return []
      }
      
      const products = await fetchProductsSearch(search, signal)
      return products.map((p: Product) => ({
        id: p.id,
        name: p.title_en || (p as any).name || String(p.id)
      }))
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to fetch products for dropdown:", e)
      }
      return []
    }
  }, [])

  const fetchWarehousesForDropdown = useCallback(async (search: string, signal?: AbortSignal): Promise<{ id: number; name: string }[]> => {
    try {
      // Ensure we have a fresh token
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
      if (!token) {
        toast({ title: "Error", description: "Authentication required. Please log in again.", variant: "destructive" })
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

  // Multi-select component for products
  const MultiSelectProducts = ({
    selectedIds,
    onSelectionChange,
    items,
    placeholder,
    onOpen,
  }: {
    selectedIds: number[]
    onSelectionChange: (ids: number[]) => void
    items: { id: number; name: string }[]
    placeholder: string
    onOpen?: () => void
  }) => {
    const [open, setOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
    const [showAllSelected, setShowAllSelected] = useState(false)
    const MAX_VISIBLE_ITEMS = 3 // Show first 3 items by default

    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedSearchQuery(searchQuery)
      }, 300)
      return () => clearTimeout(timer)
    }, [searchQuery])

    const toggleProduct = (productId: number) => {
      if (selectedIds.includes(productId)) {
        onSelectionChange(selectedIds.filter((id) => id !== productId))
      } else {
        onSelectionChange([...selectedIds, productId])
      }
    }

    const filteredItems = items.filter((item) =>
      item.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    )

    const selectedItems = items.filter((item) => selectedIds.includes(item.id))
    
    // Check if all filtered items are selected
    const allFilteredSelected = filteredItems.length > 0 && filteredItems.every(item => selectedIds.includes(item.id))
    const someFilteredSelected = filteredItems.some(item => selectedIds.includes(item.id))
    
    const handleSelectAll = () => {
      const filteredIds = filteredItems.map(item => item.id)
      if (allFilteredSelected) {
        // Deselect all filtered items
        onSelectionChange(selectedIds.filter(id => !filteredIds.includes(id)))
      } else {
        // Select all filtered items (merge with existing selections)
        const newSelection = [...new Set([...selectedIds, ...filteredIds])]
        onSelectionChange(newSelection)
      }
    }

  return (
      <div className="space-y-2">
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (next && onOpen) onOpen()
            if (!next) {
              setSearchQuery("")
              setDebouncedSearchQuery("")
              setShowAllSelected(false) // Reset show all when closing
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="justify-between w-full">
              {selectedIds.length > 0
                ? `${selectedIds.length} product${selectedIds.length === 1 ? "" : "s"} selected`
                : placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="p-0 w-[400px] max-h-[400px] flex flex-col overflow-hidden"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command shouldFilter={false} className="flex flex-col h-full">
              <div className="flex-shrink-0 border-b">
                <CommandInput
                  placeholder="Search products..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <CommandList className="h-full overflow-y-auto overflow-x-hidden">
                  <CommandEmpty>No products found.</CommandEmpty>
                  {filteredItems.length > 0 && (
                    <div className="border-b px-2 py-1.5 bg-muted/50">
                      <div
                        className="flex items-center space-x-2 w-full cursor-pointer hover:bg-muted rounded px-2 py-1.5 -mx-2 -my-1.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectAll()
                        }}
                      >
                        <Checkbox
                          checked={allFilteredSelected}
                          className="h-4 w-4"
                          onChange={handleSelectAll}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm font-medium flex-1">
                          {allFilteredSelected ? "Deselect All" : "Select All"}
                        </span>
                        {someFilteredSelected && !allFilteredSelected && (
                          <span className="text-xs text-muted-foreground">
                            ({filteredItems.filter(item => selectedIds.includes(item.id)).length} of {filteredItems.length})
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <CommandGroup>
                  {filteredItems.map((item) => {
                    const isSelected = selectedIds.includes(item.id)
                    return (
                      <CommandItem
                        key={item.id}
                        value={String(item.id)}
                          onSelect={() => {
                          toggleProduct(item.id)
                        }}
                        className="cursor-pointer"
                      >
                        <div 
                          className="flex items-center space-x-2 w-full"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleProduct(item.id)
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            onChange={() => {
                              toggleProduct(item.id)
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                          />
                          <span className="flex-1">{item.name}</span>
                        </div>
                      </CommandItem>
                    )
                  })}
                  </CommandGroup>
                </CommandList>
              </div>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    )
  }

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
                    <BreadcrumbPage>Product Transfer</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
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
                        items={productOptions}
                        placeholder="Select products..."
                        onOpen={() => { if (!products.length) void fetchLookups() }}
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
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(showAllSelected ? productOptions.filter(p => selectedProductIds.includes(p.id)) : productOptions.filter(p => selectedProductIds.includes(p.id)).slice(0, MAX_VISIBLE_ITEMS)).map((item) => (
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
                <div className="border-t bg-background px-4 py-3 flex justify-end">
                    <Button 
                      variant="default" 
                      disabled={isLoading || isSavingAll} 
                      onClick={() => void handleSaveAll()}
                    >
                      {isSavingAll ? "Transferring..." : "Save All Changes"}
                  </Button>
                </div>
              )}

                {/* Results Grid */}
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                      <thead>
                      <tr className="text-sm border-b">
                          <th className="text-left font-medium p-2">Products</th>
                          <th className="text-left font-medium p-2">From</th>
                          <th className="text-left font-medium p-2">To</th>
                          <th className="text-left font-medium p-2">Transfer</th>
                      </tr>
                    </thead>
                      <tbody>
                      {!hasRequested ? (
                        <tr>
                            <td colSpan={4} className="py-8 text-center text-muted-foreground">
                              Select products and warehouses, then click Search to load data
                          </td>
                        </tr>
                      ) : isLoading ? (
                          Array.from({ length: 5 }).map((_, index) => (
                            <tr key={`skeleton-${index}`} className="border-b last:border-0">
                              <td className="p-2">
                                <Skeleton className="h-5 w-32" />
                              </td>
                              <td className="p-2">
                                <Skeleton className="h-5 w-20" />
                              </td>
                              <td className="p-2">
                                <Skeleton className="h-5 w-20" />
                              </td>
                              <td className="p-2">
                                <Skeleton className="h-8 w-24" />
                          </td>
                        </tr>
                          ))
                        ) : transferRows.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="py-8 text-center">
                              No products selected
                          </td>
                        </tr>
                        ) : (
                          transferRows.map((row) => {
                            const transferQty = transferQuantities[row.productId] || 0
                            const isValid = transferQty <= row.fromQuantity
                            const fromWarehouseName = getWarehouseName(fromWarehouseId) || `Warehouse ${fromWarehouseId}`
                            const toWarehouseName = getWarehouseName(toWarehouseId) || `Warehouse ${toWarehouseId}`
                            
                              return (
                              <tr key={row.productId} className="border-b last:border-0 hover:bg-muted/50">
                                <td className="p-2 font-medium">{row.productName}</td>
                                  <td className="p-2">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">{row.fromQuantity}</span>
                                    <span className="text-xs text-muted-foreground">{fromWarehouseName}</span>
                                  </div>
                                  </td>
                                <td className="p-2">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">{row.toQuantity}</span>
                                    <span className="text-xs text-muted-foreground">{toWarehouseName}</span>
                                    </div>
                                  </td>
                            <td className="p-2">
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
                            </td>
                          </tr>
                            )
                          })
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
    </ErrorBoundary>
  )
}
