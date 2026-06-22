"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
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
import { Edit, Trash2, MoreHorizontal, PlusCircle, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { MultiSelectProducts } from "@/components/multi-select-products"
import { API_URL } from "@/lib/config"

type Product = {
  id: number
  title_en?: string
  title_ar?: string
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
  created_at?: string
  updated_at?: string
}

export default function InventoryManagementPage() {
  const [mounted, setMounted] = useState<boolean>(false)
  const [items, setItems] = useState<Inventory[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [hasRequested, setHasRequested] = useState<boolean>(false)
  const [count, setCount] = useState<number>(0)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [totalPages, setTotalPages] = useState<number>(0)

  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  
  // Loading states for async dropdowns
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false)
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState<boolean>(false)

  // Filter states - using array for products (like transfer page)
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [productLabelById, setProductLabelById] = useState<Record<number, string>>({})
  const [filterWarehouseId, setFilterWarehouseId] = useState<string>("")
  const [showAllSelected, setShowAllSelected] = useState(false)
  const MAX_VISIBLE_ITEMS = 3 // Show first 3 items by default

  // Sorting state
  const [sortField, setSortField] = useState<string>("-created_at")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const [isAddOpen, setIsAddOpen] = useState<boolean>(false)
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false)
  const [editItem, setEditItem] = useState<Inventory | null>(null)

  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string>("")

  const [newInventory, setNewInventory] = useState<Partial<Inventory>>({
    product_id: undefined,
    warehouse_id: undefined,
    quantity: 0,
  })
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]) // Array of product IDs for Add dialog

  // Cache keys for localStorage
  const CACHE_KEYS = {
    WAREHOUSES: "inventory_warehouses_data",
    WAREHOUSES_TIMESTAMP: "inventory_warehouses_timestamp",
  }
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

  const [draftQtyByKey, setDraftQtyByKey] = useState<Record<string, number>>({})
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false)
  const [isCreating, setIsCreating] = useState<boolean>(false)
  const [isUpdating, setIsUpdating] = useState<boolean>(false)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)
  const [isUpdatingRow, setIsUpdatingRow] = useState<string | null>(null) // Track which row is being updated (using key)

  // AbortController ref for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null)

  // Track access token in state to ensure headers update when token changes
  // Initialize as null to avoid hydration mismatch - will be set in useEffect
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Update token when localStorage changes (e.g., after login/refresh)
  useEffect(() => {
    // Only run on client side to avoid hydration mismatch
    if (typeof window === "undefined") return

    const handleStorageChange = () => {
      const token = localStorage.getItem("accessToken")
      setAccessToken(token)
    }

    // Set initial token from localStorage
    handleStorageChange()

    // Listen for storage events (e.g., token refresh in another tab)
    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [])

  // Memoized auth headers that updates when token changes
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


  // Stable UTC formatter to avoid SSR/CSR locale/timezone mismatches
  const formatDateUTC = (iso?: string) => {
    if (!iso) return "-"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "-"
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  }

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
            })
          }
        })
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Request failed after retries')
  }, [])

  useEffect(() => {
    setMounted(true)
    
    // Wait for accessToken to be available before fetching lookups
    // This ensures we have a valid token when making the request
    if (typeof window === "undefined") return
    
    const checkAndFetch = () => {
      const token = localStorage.getItem("accessToken")
      if (token) {
        // Create new AbortController for this effect
        const abortController = new AbortController()
        abortControllerRef.current = abortController
        
        void fetchLookups(abortController.signal)
      } else {
        // Retry after a short delay if token not yet available
        setTimeout(checkAndFetch, 100)
      }
    }
    
    // Start checking for token
    checkAndFetch()
    
    // Cleanup: abort requests on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  const buildQuery = (page?: number, pageSizeParam?: number) => {
    const params = new URLSearchParams()
    // Handle multiple product IDs (like transfer page)
    if (selectedProductIds.length > 0) {
      selectedProductIds.forEach(id => {
        params.append("product_id", id.toString())
      })
    }
    if (filterWarehouseId) params.set("warehouse_id", filterWarehouseId)
    
    // Add sorting params
    if (sortField) {
      params.set("ordering", sortField)
    }
    
    // Add pagination params
    const pageToUse = page ?? currentPage
    const pageSizeToUse = pageSizeParam ?? pageSize
    params.set("page", pageToUse.toString())
    params.set("page_size", pageSizeToUse.toString())
    
    return params.toString()
  }

  // Handle column header click for sorting
  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      // Toggle between asc and desc
      const newOrder = sortOrder === "asc" ? "desc" : "asc"
      setSortOrder(newOrder)
      setSortField(newOrder === "asc" ? field : `-${field}`)
    } else if (sortField === `-${field}`) {
      // Currently descending, switch to ascending
      setSortOrder("asc")
      setSortField(field)
    } else {
      // New field, default to descending
      setSortOrder("desc")
      setSortField(`-${field}`)
    }
    setCurrentPage(1) // Reset to first page when sorting changes
  }, [sortField, sortOrder])

  // Get sort indicator for a column
  const getSortIndicator = useCallback((field: string) => {
    const isActive = sortField === field || sortField === `-${field}`
    if (!isActive) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-30" />
    }
    if (sortField === `-${field}`) {
      return <ArrowDown className="h-4 w-4 ml-1" />
    }
    return <ArrowUp className="h-4 w-4 ml-1" />
  }, [sortField])

  // Fetch products with server-side search (for dropdowns)
  const fetchProductsSearch = async (
    search: string = "",
    signal?: AbortSignal,
    options?: { trackLoading?: boolean },
  ): Promise<Product[]> => {
    const trackLoading = options?.trackLoading !== false
    if (trackLoading) setIsLoadingProducts(true)
    try {
      // Get token directly from localStorage to ensure it's fresh
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      }
      
      const params = new URLSearchParams()
      params.append("page_size", "50") // Only fetch 50 items initially
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
          throw new Error(`Products request failed (${res.status}) for ${res.url}: ${text.slice(0, 200)}`)
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

  // Fetch warehouses with server-side search (for dropdowns)
  const fetchWarehousesSearch = async (search: string = "", signal?: AbortSignal): Promise<Warehouse[]> => {
    setIsLoadingWarehouses(true)
    try {
      // Get token directly from localStorage to ensure it's fresh
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      }
      
      const params = new URLSearchParams()
      params.append("page_size", "50") // Only fetch 50 items initially
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
          throw new Error(`Warehouses request failed (${res.status}) for ${res.url}: ${text.slice(0, 200)}`)
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
      if (!forceRefresh) {
        const cachedData = localStorage.getItem(CACHE_KEYS.WAREHOUSES)
        const cachedTimestamp = localStorage.getItem(CACHE_KEYS.WAREHOUSES_TIMESTAMP)

        if (cachedData && cachedTimestamp) {
          const timestamp = parseInt(cachedTimestamp, 10)
          const now = Date.now()

          if (now - timestamp < CACHE_DURATION) {
            try {
              const warehouses = JSON.parse(cachedData)
              setWarehouses(Array.isArray(warehouses) ? warehouses : [])
              return
            } catch (parseError) {
              if (process.env.NODE_ENV !== "production") {
                console.error("Error parsing cached warehouse data:", parseError)
              }
              localStorage.removeItem(CACHE_KEYS.WAREHOUSES)
              localStorage.removeItem(CACHE_KEYS.WAREHOUSES_TIMESTAMP)
            }
          }
        }
      }

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

      const wRes = await fetchWithRetry(
        `${API_URL}/inventory/warehouses/?page_size=1000`,
        { headers, signal: signal || abortControllerRef.current?.signal },
      )

      const ensureJson = async (res: Response) => {
        const ct = res.headers.get("content-type") || ""
        if (!ct.includes("application/json")) {
          const text = await res.text()
          throw new Error(`Warehouse lookup failed (${res.status}): ${text.slice(0, 200)}`)
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

      const wList = normalizeList(wData)
      setWarehouses(wList)

      try {
        localStorage.setItem(CACHE_KEYS.WAREHOUSES, JSON.stringify(wList))
        localStorage.setItem(CACHE_KEYS.WAREHOUSES_TIMESTAMP, Date.now().toString())
      } catch (cacheError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Failed to cache warehouse data:", cacheError)
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return
      }
      if (process.env.NODE_ENV !== "production") {
        console.error("Lookup fetch failed", e)
      }
      toast({ title: "Error", description: "Failed to load warehouses", variant: "destructive" })
    }
  }

  const fetchInventory = async (page?: number, pageSizeParam?: number, signal?: AbortSignal) => {
    setIsLoading(true)
    try {
      const qs = buildQuery(page, pageSizeParam)
      const res = await fetchWithRetry(`${API_URL}/inventory/inventory/?${qs}`, { 
        headers: authHeaders,
        signal: signal || abortControllerRef.current?.signal
      })
      const ct = res.headers.get("content-type") || ""
      if (!res.ok || !ct.includes("application/json")) {
        const text = await res.text()
        throw new Error(`Inventory list failed (${res.status}) for ${res.url}: ${text.slice(0, 200)}`)
      }
      const data = await res.json()
      const list: Inventory[] = data?.results ?? data ?? []
      setItems(Array.isArray(list) ? list : [])
      // Initialize draft quantities for quick inline edits
      const nextDraft: Record<string, number> = {}
      list.forEach((inv: any) => {
        const pid = typeof inv.product === "number" ? inv.product : inv.product?.id
        const wid = typeof inv.warehouse === "number" ? inv.warehouse : inv.warehouse?.id
        if (pid && wid) nextDraft[`${pid}-${wid}`] = Number(inv.quantity) || 0
      })
      setDraftQtyByKey((prev) => ({ ...nextDraft, ...prev }))
      
      // Handle paginated response
      const totalCount = typeof data?.count === "number" ? data.count : Array.isArray(list) ? list.length : 0
      setCount(totalCount)
      
      // Calculate total pages
      const pageSizeToUse = pageSizeParam ?? pageSize
      const pages = totalCount > 0 ? Math.ceil(totalCount / pageSizeToUse) : 0
      setTotalPages(pages)
      
      // Update current page if provided
      if (page !== undefined) {
        setCurrentPage(page)
      }
    } catch (e) {
      // Ignore abort errors
      if (e instanceof Error && e.name === 'AbortError') {
        return
      }
      if (process.env.NODE_ENV !== "production") {
      console.error("Fetch inventory failed", e)
      }
      setItems([])
      setCount(0)
      setTotalPages(0)
      toast({ title: "Error", description: "Failed to load inventory list", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async () => {
    // Prevent double-clicks
    if (isCreating) return
    
    try {
      setIsCreating(true)
      
      // Validate warehouse and quantity
      if (!newInventory.warehouse_id) {
        toast({ title: "Error", description: "Please select a warehouse", variant: "destructive" })
        setIsCreating(false)
        return
      }

      const warehouseId = Number(newInventory.warehouse_id)
      const quantity = Number(newInventory.quantity ?? 0)

      // Store original state for rollback
      const originalItems = [...items]

      // If multiple products selected, use bulk endpoint
      if (selectedProducts.length > 0) {
        const bulkData = selectedProducts.map((productId) => ({
          product_id: productId,
          warehouse_id: warehouseId,
          quantity: quantity,
        }))

        // Optimistically add items to UI (temporary IDs for new items)
        const optimisticItems = selectedProducts.map((productId, index) => ({
          id: -(index + 1), // Temporary negative ID
          product: productId as any,
          product_id: productId,
          warehouse: warehouseId as any,
          warehouse_id: warehouseId,
          quantity: quantity,
          updated_at: new Date().toISOString(),
        })) as Inventory[]
        
        setItems(prev => [...prev, ...optimisticItems])
        setIsAddOpen(false)
        setSelectedProducts([])
        setNewInventory({ product_id: undefined, warehouse_id: undefined, quantity: 0 })

        const res = await fetchWithRetry(`${API_URL}/inventory/inventory/bulk/`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(bulkData),
          signal: abortControllerRef.current?.signal
        })
        const ct = res.headers.get("content-type") || ""
        if (!res.ok) {
          // Rollback on error
          setItems(originalItems)
          setIsAddOpen(true)
          setSelectedProducts(selectedProducts)
          setNewInventory({ product_id: undefined, warehouse_id: warehouseId, quantity: quantity })
          const text = await res.text()
          let errorMessage = `Bulk create failed (${res.status})`
          try {
            const errorData = JSON.parse(text)
            errorMessage = errorData.detail || errorData.message || errorMessage
            if (errorData.errors) {
              errorMessage += `: ${JSON.stringify(errorData.errors)}`
            }
          } catch {
            errorMessage += `: ${text.slice(0, 200)}`
          }
          throw new Error(errorMessage)
        }
        if (!ct.includes("application/json")) {
          // Rollback on error
          setItems(originalItems)
          setIsAddOpen(true)
          setSelectedProducts(selectedProducts)
          setNewInventory({ product_id: undefined, warehouse_id: warehouseId, quantity: quantity })
          const text = await res.text()
          throw new Error(`Bulk create failed: Invalid response format - ${text.slice(0, 200)}`)
        }
        const data = await res.json()
        
        // Replace optimistic items with server response
        const results = data.results || data
        setItems(prev => {
          // Remove optimistic items (negative IDs)
          const withoutOptimistic = prev.filter(item => item.id > 0)
          // Add server response items
          return [...withoutOptimistic, ...results]
        })
        
        // Count created vs updated
        const createdCount = results.filter((r: any) => r._action === 'created').length
        const updatedCount = results.filter((r: any) => r._action === 'updated').length
        
        let message = ""
        if (createdCount > 0 && updatedCount > 0) {
          message = `Created ${createdCount} new inventory ${createdCount === 1 ? 'entry' : 'entries'} and updated ${updatedCount} existing ${updatedCount === 1 ? 'entry' : 'entries'}`
        } else if (createdCount > 0) {
          message = `Successfully created ${createdCount} inventory ${createdCount === 1 ? 'entry' : 'entries'}`
        } else if (updatedCount > 0) {
          message = `Successfully updated ${updatedCount} inventory ${updatedCount === 1 ? 'entry' : 'entries'} (quantity replaced)`
        } else {
          message = `Processed ${results.length} inventory ${results.length === 1 ? 'entry' : 'entries'}`
        }

        setIsCreating(false)
        toast({ 
          title: "Inventory saved", 
          description: message
        })
        // Refresh to ensure consistency
        await fetchInventory(currentPage, pageSize)
      } else if (newInventory.product_id) {
        // Single product (backward compatibility)
        // Store original state for rollback
        const originalItemsSingle = [...items]
        
      const body = {
        product_id: Number(newInventory.product_id),
          warehouse_id: warehouseId,
          quantity: quantity,
        }

        // Optimistically add item to UI
        const optimisticItem = {
          id: -1, // Temporary negative ID
          product: Number(newInventory.product_id) as any,
          product_id: Number(newInventory.product_id),
          warehouse: warehouseId as any,
          warehouse_id: warehouseId,
          quantity: quantity,
          updated_at: new Date().toISOString(),
        } as Inventory

        setItems(prev => [...prev, optimisticItem])
        setIsAddOpen(false)
        setNewInventory({ product_id: undefined, warehouse_id: undefined, quantity: 0 })

        const res = await fetchWithRetry(`${API_URL}/inventory/inventory/`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
          signal: abortControllerRef.current?.signal
      })
      const ct = res.headers.get("content-type") || ""
      if (!res.ok || !ct.includes("application/json")) {
          // Rollback on error
          setItems(originalItemsSingle)
          setIsAddOpen(true)
          setNewInventory({ product_id: Number(newInventory.product_id), warehouse_id: warehouseId, quantity: quantity })
        const text = await res.text()
        throw new Error(`Create failed (${res.status}) for ${res.url}: ${text.slice(0, 200)}`)
      }
      const data = await res.json()

        // Replace optimistic item with server response
        setItems(prev => {
          const withoutOptimistic = prev.filter(item => item.id > 0)
          return [...withoutOptimistic, data]
        })

        setIsCreating(false)
      toast({ title: "Inventory saved", description: "Entry created/updated successfully" })
        // Refresh to ensure consistency
        await fetchInventory(currentPage, pageSize)
      } else {
        toast({ title: "Error", description: "Please select at least one product", variant: "destructive" })
        setIsCreating(false)
      }
    } catch (e) {
      // Ignore abort errors
      if (e instanceof Error && e.name === 'AbortError') {
        setIsCreating(false)
        return
      }
      const msg = e instanceof Error ? e.message : "Failed to save inventory"
      toast({ title: "Error", description: msg, variant: "destructive" })
      setIsCreating(false)
    }
  }

  const handleEdit = async () => {
    if (!editItem || isUpdating) return
    
    // Store original item for rollback
    const originalItem = items.find(item => item.id === editItem.id)
    if (!originalItem) return
    
    setIsUpdating(true)
    try {
      // Optimistically update UI
      setItems(prev => prev.map(item => 
        item.id === editItem.id 
          ? { ...item, ...editItem, quantity: Number(editItem.quantity) }
          : item
      ))
      setIsEditOpen(false)
      const itemToEdit = editItem
      setEditItem(null)

      const res = await fetchWithRetry(`${API_URL}/inventory/inventory/${itemToEdit.id}/`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          product_id: itemToEdit.product?.id ?? itemToEdit.product_id,
          warehouse_id: itemToEdit.warehouse?.id ?? itemToEdit.warehouse_id,
          quantity: Number(itemToEdit.quantity),
        }),
        signal: abortControllerRef.current?.signal
      })
      const ct = res.headers.get("content-type") || ""
      if (!res.ok || !ct.includes("application/json")) {
        // Rollback on error
        setItems(prev => prev.map(item => item.id === originalItem.id ? originalItem : item))
        setIsEditOpen(true)
        setEditItem(itemToEdit)
        const text = await res.text()
        throw new Error(`Update failed (${res.status}) for ${res.url}: ${text.slice(0, 200)}`)
      }
      const data = await res.json()
      
      // Replace with server response
      setItems(prev => prev.map(item => item.id === data.id ? data : item))
      
      toast({ title: "Inventory updated", description: "Entry updated successfully" })
      // Refresh to ensure consistency
      await fetchInventory(currentPage, pageSize)
    } catch (e) {
      // Ignore abort errors
      if (e instanceof Error && e.name === 'AbortError') {
        setIsUpdating(false)
        return
      }
      const msg = e instanceof Error ? e.message : "Failed to update inventory"
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (deleteId == null || isDeleting) return
    
    // Store original state for rollback
    const originalItems = [...items]
    const itemToDelete = items.find(item => item.id === deleteId)
    
    setIsDeleting(true)
    try {
      // Optimistically remove from UI
      setItems(prev => prev.filter(item => item.id !== deleteId))
      setIsDeleteOpen(false)
      const idToDelete = deleteId
      setDeleteId(null)
      setDeleteConfirm("")

      const res = await fetchWithRetry(`${API_URL}/inventory/inventory/${idToDelete}/delete/`, {
        method: "DELETE",
        headers: authHeaders,
        signal: abortControllerRef.current?.signal
      })
      if (!res.ok) {
        // Rollback on error
        setItems(originalItems)
        setIsDeleteOpen(true)
        setDeleteId(idToDelete)
        setDeleteConfirm("")
        const text = await res.text().catch(() => "")
        throw new Error(`Delete failed (${res.status}) for ${res.url}: ${text.slice(0, 200)}`)
      }
      
      toast({ title: "Inventory deleted", description: "Inventory entry deleted successfully", variant: "destructive" })
      
      // If we deleted the last item on the page and it's not page 1, go to previous page
      if (originalItems.length === 1 && currentPage > 1) {
        const prevPage = currentPage - 1
        setCurrentPage(prevPage)
        await fetchInventory(prevPage, pageSize)
      } else {
        // Refresh to ensure consistency
        await fetchInventory(currentPage, pageSize)
      }
    } catch (e) {
      // Ignore abort errors
      if (e instanceof Error && e.name === 'AbortError') {
        setIsDeleting(false)
        return
      }
      const msg = e instanceof Error ? e.message : "Failed to delete inventory"
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setIsDeleting(false)
    }
  }

  const openEditDialog = (item: Inventory) => {
    setEditItem({ ...item })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (id: number) => {
    setDeleteId(id)
    setIsDeleteOpen(true)
  }


  const getProductDisplayName = useCallback((product: Product) => {
    return product.title_en || product.title_ar || product.name || String(product.id)
  }, [])

  const handleProductSelected = useCallback((id: number, name: string) => {
    setProductLabelById((prev) => ({ ...prev, [id]: name }))
  }, [])

  const selectedProductOptions = useMemo(
    () =>
      selectedProductIds.map((id) => ({
        id,
        name: productLabelById[id] || getProductDisplayName(products.find((p) => p.id === id) || { id }),
      })),
    [selectedProductIds, productLabelById, products, getProductDisplayName],
  )

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ id: w.id, name: w.name_en || (w as any).name || String(w.id) })),
    [warehouses]
  )

  // Memoized lookup Maps for O(1) access
  const productMap = useMemo(() => {
    const map = new Map<number, Product>()
    products.forEach((p) => {
      map.set(p.id, p)
    })
    return map
  }, [products])

  const warehouseMap = useMemo(() => {
    const map = new Map<number, Warehouse>()
    warehouses.forEach((w) => {
      map.set(w.id, w)
    })
    return map
  }, [warehouses])

  // Simplified merged rows - backend already handles filtering by product_id and warehouse_id
  // We only need to filter out zero-quantity items if needed
  // Helper functions for async dropdowns - MUST be before early return
  const getProductNameAsync = useCallback(async (id: number): Promise<string | undefined> => {
    // First check cache
    const cached = productMap.get(id)
    if (cached) {
      return cached.title_en || cached.title_ar || (cached as any).name || undefined
    }
    // If not in cache, fetch it
    try {
      const items = await fetchProductsSearch("", abortControllerRef.current?.signal)
      const found = items.find((p: Product) => p.id === id)
      if (found) {
        return getProductDisplayName(found)
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to fetch product name:", e)
      }
    }
    return undefined
  }, [productMap, getProductDisplayName])

  const getWarehouseNameAsync = useCallback(async (id: number): Promise<string | undefined> => {
    // First check cache
    const cached = warehouseMap.get(id)
    if (cached) {
      return cached.name_en || (cached as any).name || undefined
    }
    // If not in cache, fetch it
    try {
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
  }, [warehouseMap])

  // Wrapper functions for async dropdowns
  const fetchProductsForDropdown = useCallback(async (search: string, signal?: AbortSignal): Promise<{ id: number; name: string }[]> => {
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
  }, [getProductDisplayName])

  const fetchWarehousesForDropdown = useCallback(async (search: string, signal?: AbortSignal): Promise<{ id: number; name: string }[]> => {
    const warehouses = await fetchWarehousesSearch(search, signal)
    return warehouses.map((w: Warehouse) => ({
      id: w.id,
      name: w.name_en || (w as any).name || String(w.id)
    }))
  }, [])

  const mergedRows = useMemo(() => {
    if (!hasRequested) return []

    // Backend already filters by product_id and warehouse_id via query parameters
    // Just return the filtered items, optionally excluding zero-quantity items
    // Note: Zero-quantity items are valid inventory entries and should be shown
    // to allow users to update quantities. Only filter if specifically needed.
    return items
  }, [hasRequested, items])

  // Virtualization setup for table rows - only virtualize if more than 50 items
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const shouldVirtualize = mergedRows.length > 50

  const rowVirtualizer = useVirtualizer({
    count: mergedRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 60, // Estimated row height in pixels
    overscan: 5, // Render 5 extra items above and below viewport for smooth scrolling
  })

  const virtualItems = shouldVirtualize ? rowVirtualizer.getVirtualItems() : []
  const totalSize = shouldVirtualize ? rowVirtualizer.getTotalSize() : 0

  const getRowKey = (inv: any) => {
    const pid = typeof inv.product === "number" ? inv.product : inv.product?.id || inv.product_id
    const wid = typeof inv.warehouse === "number" ? inv.warehouse : inv.warehouse?.id || inv.warehouse_id
    return `${pid || 0}-${wid || 0}`
  }

  const getDraftQty = (inv: any) => {
    const key = getRowKey(inv)
    const current = draftQtyByKey[key]
    return typeof current === "number" ? current : Number(inv.quantity) || 0
  }

  const setDraftForRow = (inv: any, qty: number) => {
    const key = getRowKey(inv)
    setDraftQtyByKey((s) => ({ ...s, [key]: qty }))
  }

  const saveRow = async (inv: any) => {
    const pid = typeof inv.product === "number" ? inv.product : inv.product?.id || inv.product_id
    const wid = typeof inv.warehouse === "number" ? inv.warehouse : inv.warehouse?.id || inv.warehouse_id
    const qty = getDraftQty(inv)
    if (!pid || !wid) return
    
    const rowKey = getRowKey(inv)
    if (isUpdatingRow === rowKey) return // Prevent duplicate saves
    
    // Store original state for rollback
    const originalItems = [...items]
    const originalDraftQty = draftQtyByKey[`${pid}-${wid}`]
    
    setIsUpdatingRow(rowKey)
    try {
      // Optimistically update UI
      setItems(prev => prev.map(item => {
        const itemPid = typeof item.product === "number" ? item.product : item.product?.id || item.product_id
        const itemWid = typeof item.warehouse === "number" ? item.warehouse : item.warehouse?.id || item.warehouse_id
        if (itemPid === pid && itemWid === wid) {
          return { ...item, quantity: Number(qty) }
        }
        return item
      }))
      // Clear draft quantity
      setDraftQtyByKey(prev => {
        const updated = { ...prev }
        delete updated[`${pid}-${wid}`]
        return updated
      })

      let res: Response
      if (inv.id && inv.id !== 0) {
        res = await fetchWithRetry(`${API_URL}/inventory/inventory/${inv.id}/`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ quantity: Number(qty) }),
          signal: abortControllerRef.current?.signal
        })
      } else {
        // Upsert by POST
        res = await fetchWithRetry(`${API_URL}/inventory/inventory/`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ product_id: Number(pid), warehouse_id: Number(wid), quantity: Number(qty) }),
          signal: abortControllerRef.current?.signal
        })
      }
      const ct = res.headers.get("content-type") || ""
      if (!res.ok || !ct.includes("application/json")) {
        // Rollback on error
        setItems(originalItems)
        setDraftQtyByKey(prev => ({ ...prev, [`${pid}-${wid}`]: originalDraftQty }))
        const text = await res.text()
        throw new Error(`Save failed (${res.status}) for ${res.url}: ${text.slice(0, 200)}`)
      }
      const data = await res.json()
      
      // Replace with server response
      setItems(prev => prev.map(item => item.id === data.id ? data : item))
      
      toast({ title: "Saved", description: "Inventory updated" })
      // Refresh to ensure consistency
      await fetchInventory(currentPage, pageSize)
    } catch (e) {
      // Ignore abort errors
      if (e instanceof Error && e.name === 'AbortError') {
        setIsUpdatingRow(null)
        return
      }
      const msg = e instanceof Error ? e.message : "Failed to save"
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setIsUpdatingRow(null)
    }
  }

  const saveAll = async () => {
    if (!hasRequested) return
    
    // Store original state for rollback
    const originalItems = [...items]
    const originalDraftQtyByKey = { ...draftQtyByKey }
    
    setIsSavingAll(true)
    try {
      // Determine changed rows by comparing draft vs current quantity
      const rows = mergedRows as any[]
      const changes = rows.filter((inv) => {
        const current = Number(inv.quantity) || 0
        const draft = getDraftQty(inv)
        return Number(draft) !== current
      })

      if (changes.length === 0) {
        toast({ title: "No changes", description: "No changes to save" })
        setIsSavingAll(false)
        return
      }

      // Optimistically update UI for all changes
      setItems(prev => prev.map(item => {
        const change = changes.find(inv => {
          const invPid = typeof inv.product === "number" ? inv.product : inv.product?.id || inv.product_id
          const invWid = typeof inv.warehouse === "number" ? inv.warehouse : inv.warehouse?.id || inv.warehouse_id
          const itemPid = typeof item.product === "number" ? item.product : item.product?.id || item.product_id
          const itemWid = typeof item.warehouse === "number" ? item.warehouse : item.warehouse?.id || item.warehouse_id
          return invPid === itemPid && invWid === itemWid
        })
        if (change) {
          const qty = getDraftQty(change)
          return { ...item, quantity: Number(qty) }
        }
        return item
      }))
      // Clear all draft quantities
      setDraftQtyByKey({})

      // Prepare bulk update data
      const updates = changes.map((inv) => {
        const pid = typeof inv.product === "number" ? inv.product : inv.product?.id || inv.product_id
        const wid = typeof inv.warehouse === "number" ? inv.warehouse : inv.warehouse?.id || inv.warehouse_id
        const qty = getDraftQty(inv)
        
        if (inv.id && inv.id !== 0) {
          // Update existing inventory
          return {
            id: inv.id,
            quantity: Number(qty),
          }
        } else {
          // Create new inventory
          return {
            product_id: Number(pid),
            warehouse_id: Number(wid),
            quantity: Number(qty),
          }
        }
      }).filter(item => item !== null)

      // Use bulk API
      const res = await fetchWithRetry(`${API_URL}/inventory/inventory/bulk/`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(updates),
        signal: abortControllerRef.current?.signal
      })

      const ct = res.headers.get("content-type") || ""
      if (!res.ok || !ct.includes("application/json")) {
        // Rollback on error
        setItems(originalItems)
        setDraftQtyByKey(originalDraftQtyByKey)
        const text = await res.text().catch(() => "")
        let errorMessage = `Bulk save failed (${res.status})`
        try {
          const errorData = JSON.parse(text)
          errorMessage = errorData.detail || errorData.message || errorMessage
          if (errorData.errors) {
            errorMessage += `: ${JSON.stringify(errorData.errors)}`
          }
        } catch {
          errorMessage += `: ${text.slice(0, 200)}`
        }
        throw new Error(errorMessage)
      }

      const data = await res.json()
      const results = data.results || data

      // Replace with server responses
      const resultsMap = new Map(results.map((item: any) => [item.id, item as Inventory]))
      setItems(prev => prev.map(item => (resultsMap.get(item.id) || item) as Inventory))

      toast({ 
        title: "All changes saved", 
        description: `Successfully updated ${results.length} inventory ${results.length === 1 ? 'item' : 'items'}` 
      })
      // Refresh to ensure consistency
      await fetchInventory(currentPage, pageSize)
    } catch (e) {
      // Ignore abort errors
      if (e instanceof Error && e.name === 'AbortError') {
        setIsSavingAll(false)
        return
      }
      const msg = e instanceof Error ? e.message : "Failed to save changes"
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setIsSavingAll(false)
    }
  }

  // Regular helper functions (not hooks, can be after early return)
  const getProductName = (id?: number | string) => {
    if (id === undefined || id === null) return undefined
    const n = Number(id)
    if (isNaN(n)) return undefined
    const p = productMap.get(n)
    return p ? getProductDisplayName(p) : productLabelById[n]
  }

  const getWarehouseName = (id?: number | string) => {
    if (id === undefined || id === null) return undefined
    const n = Number(id)
    if (isNaN(n)) return undefined
    const w = warehouseMap.get(n)
    return w?.name_en || (w as any)?.name || undefined
  }

  const getInventoryProductLabel = (inv: Inventory) => {
    const prod: any = (inv as any).product
    if (!prod) return "-"
    if (typeof prod === "number") return getProductName(prod) || "-"
    return prod.title_en || prod.title_ar || prod.name || getProductName(prod.id) || "-"
  }

  const getInventoryWarehouseLabel = (inv: Inventory) => {
    const wh: any = (inv as any).warehouse
    if (!wh) return "-"
    if (typeof wh === "number") return getWarehouseName(wh) || "-"
    return wh.name_en || wh.name || getWarehouseName(wh.id) || "-"
  }

  // Early return MUST be after all hooks
  if (!mounted) {
    return null
  }

  // Async SearchableCombobox with server-side search
  const AsyncSearchableCombobox = ({
    value,
    onChange,
    placeholder,
    allowAll,
    fetchItems,
    isLoading,
    getItemName,
  }: {
    value: string | number | undefined
    onChange: (val: string) => void
    placeholder: string
    allowAll?: boolean
    fetchItems: (search: string, signal?: AbortSignal) => Promise<{ id: number; name: string }[]>
    isLoading: boolean
    getItemName: (id: number) => Promise<string | undefined>
  }) => {
    const [open, setOpen] = useState(false)
    const [items, setItems] = useState<{ id: number; name: string }[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [currentLabel, setCurrentLabel] = useState<string | undefined>(undefined)
    const searchAbortRef = useRef<AbortController | null>(null)

    // Debounce search query
    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedSearch(searchQuery)
      }, 300)
      return () => clearTimeout(timer)
    }, [searchQuery])

    // Fetch items when dropdown opens or search changes
    useEffect(() => {
      if (!open) {
        // Reset items when closed to avoid stale data
        setItems([])
        return
      }

      // Cancel previous request
      if (searchAbortRef.current) {
        searchAbortRef.current.abort()
      }

      const controller = new AbortController()
      searchAbortRef.current = controller

      const loadItems = async () => {
        try {
          const fetchedItems = await fetchItems(debouncedSearch, controller.signal)
          if (!controller.signal.aborted) {
            setItems(fetchedItems || [])
          }
        } catch (e) {
          if (e instanceof Error && e.name !== 'AbortError') {
            if (process.env.NODE_ENV !== "production") {
              console.error("Failed to fetch items:", e)
            }
            // Set empty array on error so UI shows "No results found"
            if (!controller.signal.aborted) {
              setItems([])
            }
          }
        }
      }

      // Fetch immediately when dropdown opens
      void loadItems()

      return () => {
        if (searchAbortRef.current) {
          searchAbortRef.current.abort()
        }
      }
    }, [open, debouncedSearch, fetchItems])

    // Load current label when value changes
    useEffect(() => {
      if (value && value !== "all") {
        getItemName(Number(value)).then(name => setCurrentLabel(name || undefined))
      } else {
        setCurrentLabel(undefined)
      }
    }, [value, getItemName])

    return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setSearchQuery("")
            setDebouncedSearch("")
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="justify-between">
            {currentLabel || (value === "all" ? "All" : placeholder)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[280px]">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder={`Search ${placeholder.toLowerCase()}...`} 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-[300px] overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
              ) : items.length === 0 ? (
                <CommandEmpty>No results found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {allowAll && (
                    <CommandItem
                      key="all"
                      value="all"
                      onSelect={() => {
                        onChange("all")
                        setOpen(false)
                      }}
                    >
                      All
                    </CommandItem>
                  )}
                  {items.map((it) => (
                    <CommandItem
                      key={it.id}
                      value={String(it.id)}
                      onSelect={(v) => {
                        onChange(v)
                        setOpen(false)
                      }}
                    >
                      {it.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  // Legacy SearchableCombobox (kept for backward compatibility)
  const SearchableCombobox = ({
    value,
    onChange,
    items,
    placeholder,
    allowAll,
    onOpen,
  }: {
    value: string | number | undefined
    onChange: (val: string) => void
    items: { id: number; name: string }[]
    placeholder: string
    allowAll?: boolean
    onOpen?: () => void
  }) => {
    const [open, setOpen] = useState(false)
    const currentLabel = value && value !== "all" ? items.find((i) => i.id === Number(value))?.name : undefined
    return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next && onOpen) onOpen()
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="justify-between">
            {currentLabel || (value === "all" ? "All" : placeholder)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[280px]">
          <Command>
            <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {allowAll && (
                  <CommandItem
                    key="all"
                    value="all"
                    onSelect={() => {
                      onChange("all")
                      setOpen(false)
                    }}
                  >
                    All
                  </CommandItem>
                )}
                {items.map((it) => (
                  <CommandItem
                    key={it.id}
                    value={String(it.id)}
                    onSelect={(v) => {
                      onChange(v)
                      setOpen(false)
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
                  <BreadcrumbPage>Inventory</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">

          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Inventory Management</h2>
                <p className="text-sm text-muted-foreground">Manage product stock per warehouse.</p>
              </div>
              <div className="flex gap-2">
                <Dialog 
                  open={isAddOpen} 
                  onOpenChange={(open) => {
                    if (!open && !isCreating) {
                      // Only allow closing if not currently creating
                      setIsAddOpen(false)
                      // Reset form when closing
                      setSelectedProducts([])
                      setNewInventory({ product_id: undefined, warehouse_id: undefined, quantity: 0 })
                      setIsCreating(false)
                    } else if (open) {
                      setIsAddOpen(true)
                    }
                  }}
                >
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground">
                    <PlusCircle className="h-4 w-4 mr-2" /> Add Inventory
                  </Button>
                </DialogTrigger>
                </Dialog>
              </div>
              <Dialog 
                open={isAddOpen} 
                onOpenChange={(open) => {
                  if (!open && !isCreating) {
                    // Only allow closing if not currently creating
                    setIsAddOpen(false)
                    // Reset form when closing
                    setSelectedProducts([])
                    setNewInventory({ product_id: undefined, warehouse_id: undefined, quantity: 0 })
                    setIsCreating(false)
                  } else if (open) {
                    setIsAddOpen(true)
                  }
                }}
              >
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Inventory (Bulk)</DialogTitle>
                    <DialogDescription>
                      Select multiple products and set inventory quantity for a warehouse. All selected products will be created with the same quantity.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                      <Label>Products (Select Multiple)</Label>
                      <MultiSelectProducts
                        selectedIds={selectedProducts}
                        onSelectionChange={setSelectedProducts}
                        fetchItems={fetchProductsForDropdown}
                        selectedLabels={productLabelById}
                        onProductSelected={handleProductSelected}
                        placeholder="Select products..."
                      />
                      {selectedProducts.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {selectedProducts.length} product{selectedProducts.length === 1 ? "" : "s"} selected
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Warehouse *</Label>
                      <SearchableCombobox
                        value={newInventory.warehouse_id?.toString()}
                        onChange={(v) => setNewInventory((s) => ({ ...s, warehouse_id: Number(v) }))}
                        items={warehouseOptions}
                        placeholder="Select warehouse"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Quantity *</Label>
                      <Input 
                        type="number" 
                        value={newInventory.quantity ?? 0} 
                        onChange={(e) => setNewInventory((s) => ({ ...s, quantity: Number(e.target.value || 0) }))} 
                        min="0"
                        step="1"
                      />
                      <p className="text-xs text-muted-foreground">
                        This quantity will be applied to all selected products
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      disabled={isCreating}
                      onClick={() => {
                        setIsAddOpen(false)
                        setSelectedProducts([])
                        setNewInventory({ product_id: undefined, warehouse_id: undefined, quantity: 0 })
                        setIsCreating(false)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreate}
                      disabled={isCreating || selectedProducts.length === 0 || !newInventory.warehouse_id}
                    >
                      {isCreating ? "Creating..." : `Create ${selectedProducts.length > 0 ? `${selectedProducts.length} ` : ""}Inventory`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="border rounded-md">
              {/* Search Section */}
              <div className="bg-muted p-4">
                <div className="grid gap-4 md:grid-cols-4 md:gap-4">
                  <div className="grid gap-2">
                    <Label>Filter by Products (Multi-select)</Label>
                    <MultiSelectProducts
                      selectedIds={selectedProductIds}
                      onSelectionChange={setSelectedProductIds}
                      fetchItems={fetchProductsForDropdown}
                      selectedLabels={productLabelById}
                      onProductSelected={handleProductSelected}
                      placeholder="Select products..."
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Filter by Warehouse</Label>
                    <SearchableCombobox
                      value={filterWarehouseId || "all"}
                      onChange={(v) => setFilterWarehouseId(v === "all" ? "" : v)}
                      items={warehouseOptions}
                      placeholder="All warehouses"
                      allowAll
                      onOpen={() => { if (!warehouses.length) void fetchLookups() }}
                    />
                  </div>
                  <div className="flex gap-2 items-end">
                    <Button disabled={isSavingAll} onClick={() => { 
                      if (selectedProductIds.length === 0 && !filterWarehouseId) { 
                        toast({ title: "Select a filter", description: "Choose products or warehouse, then click Search." })
                        return
                      }
                      setHasRequested(true)
                      setCurrentPage(1) // Reset to first page on new search
                      void fetchInventory(1, pageSize)
                    }}>Search</Button>
                    <Button variant="outline" disabled={isSavingAll} onClick={() => { 
                      setSelectedProductIds([])
                      setProductLabelById({})
                      setFilterWarehouseId("")
                      setHasRequested(false)
                      setItems([])
                      setCount(0)
                      setCurrentPage(1)
                      setTotalPages(0)
                      setSortField("-created_at")
                      setSortOrder("desc")
                    }}>
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
                        setProductLabelById({})
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

              {/* Save All Changes Section - Separated */}
              {hasRequested && (
                <div className="border-t bg-background px-4 py-3 flex justify-end">
                  <Button variant="default" disabled={isLoading || isSavingAll} onClick={() => void saveAll()}>
                    {isSavingAll ? "Saving..." : "Save All Changes"}
                  </Button>
                </div>
              )}

              <div className="p-4">
                <div className="overflow-x-auto">
                  <div
                    ref={tableContainerRef}
                    style={{
                      height: shouldVirtualize ? '600px' : 'auto',
                      overflowY: shouldVirtualize ? 'auto' : 'visible',
                      position: 'relative'
                    }}
                  >
                  <table className="w-full border-collapse">
                      <thead className={shouldVirtualize ? "sticky top-0 bg-background z-10" : ""}>
                      <tr className="text-sm border-b">
                          <th 
                            className="text-left font-medium p-2 cursor-pointer hover:bg-muted/50 select-none"
                            onClick={() => handleSort("product")}
                          >
                            <div className="flex items-center">
                              Product
                              {getSortIndicator("product")}
                            </div>
                          </th>
                          <th 
                            className="text-left font-medium p-2 cursor-pointer hover:bg-muted/50 select-none"
                            onClick={() => handleSort("warehouse")}
                          >
                            <div className="flex items-center">
                              Warehouse
                              {getSortIndicator("warehouse")}
                            </div>
                          </th>
                          <th 
                            className="text-left font-medium p-2 cursor-pointer hover:bg-muted/50 select-none"
                            onClick={() => handleSort("quantity")}
                          >
                            <div className="flex items-center">
                              Quantity
                              {getSortIndicator("quantity")}
                            </div>
                          </th>
                          <th 
                            className="text-left font-medium p-2 cursor-pointer hover:bg-muted/50 select-none"
                            onClick={() => handleSort("updated_at")}
                          >
                            <div className="flex items-center">
                              Updated At
                              {getSortIndicator("updated_at")}
                            </div>
                          </th>
                        <th className="text-right font-medium p-2">Actions</th>
                      </tr>
                    </thead>
                      <tbody style={{ position: 'relative', height: shouldVirtualize && totalSize > 0 ? `${totalSize}px` : 'auto' }}>
                      {!hasRequested ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                              Select product or warehouse and click Search to load inventory
                          </td>
                        </tr>
                      ) : isLoading ? (
                          // Skeleton loaders matching table structure
                          Array.from({ length: 5 }).map((_, index) => (
                            <tr key={`skeleton-${index}`} className="border-b last:border-0">
                              <td className="p-2">
                                <Skeleton className="h-5 w-32" />
                              </td>
                              <td className="p-2">
                                <Skeleton className="h-5 w-28" />
                              </td>
                              <td className="p-2">
                                <Skeleton className="h-8 w-24" />
                              </td>
                              <td className="p-2">
                                <Skeleton className="h-4 w-36" />
                              </td>
                              <td className="p-2 text-right">
                                <div className="flex justify-end gap-2">
                                  <Skeleton className="h-8 w-8 rounded" />
                                  <Skeleton className="h-8 w-8 rounded" />
                                </div>
                          </td>
                        </tr>
                          ))
                      ) : mergedRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center">
                            No inventory entries found
                          </td>
                        </tr>
                        ) : shouldVirtualize && virtualItems.length > 0 ? (
                          <>
                            {/* Spacer for items before the first visible item */}
                            <tr>
                              <td colSpan={5} style={{ height: virtualItems[0]?.start ?? 0 }} />
                            </tr>
                            {/* Render only visible items */}
                            {virtualItems.map((virtualItem) => {
                              const inv = mergedRows[virtualItem.index]
                              if (!inv) return null
                              return (
                                <tr
                                  key={inv.id}
                                  data-index={virtualItem.index}
                                  ref={rowVirtualizer.measureElement}
                                  className="border-b last:border-0 hover:bg-muted/50"
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualItem.size}px`,
                                    transform: `translateY(${virtualItem.start}px)`,
                                    display: 'table-row',
                                  }}
                                >
                                  <td className="p-2 font-medium">{getInventoryProductLabel(inv)}</td>
                                  <td className="p-2">{getInventoryWarehouseLabel(inv)}</td>
                                  <td className="p-2">
                                    <Input
                                      type="number"
                                      className="h-8 w-24"
                                      value={getDraftQty(inv)}
                                      onChange={(e) => setDraftForRow(inv, Number(e.target.value || 0))}
                                    />
                                  </td>
                                  <td className="p-2">{formatDateUTC(inv.updated_at)}</td>
                                  <td className="p-2 text-right">
                                    <div className="flex justify-end gap-2">
                                      <div className="hidden sm:flex gap-2">
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEditDialog(inv)} disabled={isUpdating || isDeleting}>
                                          <Edit className="h-4 w-4" />
                                          <span className="sr-only">Edit</span>
                                        </Button>
                                        <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(inv.id)} disabled={isUpdating || isDeleting}>
                                          <Trash2 className="h-4 w-4" />
                                          <span className="sr-only">Delete</span>
                                        </Button>
                                      </div>
                                      <div className="sm:hidden">
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="icon" className="h-8 w-8">
                                              <MoreHorizontal className="h-4 w-4" />
                                              <span className="sr-only">Actions</span>
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => openEditDialog(inv)} disabled={isUpdating || isDeleting}>
                                              <Edit className="h-4 w-4 mr-2" /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(inv.id)} disabled={isUpdating || isDeleting}>
                                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </>
                        ) : (
                          // Non-virtualized rendering for small lists
                        mergedRows.map((inv: any) => (
                          <tr key={inv.id} className="border-b last:border-0">
                            <td className="p-2 font-medium">{getInventoryProductLabel(inv)}</td>
                            <td className="p-2">{getInventoryWarehouseLabel(inv)}</td>
                            <td className="p-2">
                                <Input
                                  type="number"
                                  className="h-8 w-24"
                                  value={getDraftQty(inv)}
                                  onChange={(e) => setDraftForRow(inv, Number(e.target.value || 0))}
                                />
                            </td>
                            <td className="p-2">{formatDateUTC(inv.updated_at)}</td>
                            <td className="p-2 text-right">
                              <div className="flex justify-end gap-2">
                                <div className="hidden sm:flex gap-2">
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEditDialog(inv)} disabled={isUpdating || isDeleting}>
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(inv.id)} disabled={isUpdating || isDeleting}>
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Delete</span>
                                  </Button>
                                </div>
                                <div className="sm:hidden">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Actions</span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => openEditDialog(inv)} disabled={isUpdating || isDeleting}>
                                        <Edit className="h-4 w-4 mr-2" /> Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(inv.id)} disabled={isUpdating || isDeleting}>
                                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>

                {/* Pagination controls */}
                {!isLoading && hasRequested && totalPages > 0 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {items.length > 0 ? ((currentPage - 1) * pageSize + 1) : 0} to {Math.min(currentPage * pageSize, count)} of {count} entries
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8" 
                        disabled={currentPage === 1 || isLoading}
                        onClick={() => {
                          const prevPage = currentPage - 1
                          setCurrentPage(prevPage)
                          void fetchInventory(prevPage, pageSize)
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8" 
                        disabled={currentPage >= totalPages || isLoading}
                        onClick={() => {
                          const nextPage = currentPage + 1
                          setCurrentPage(nextPage)
                          void fetchInventory(nextPage, pageSize)
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Edit Inventory Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Inventory</DialogTitle>
            <DialogDescription>Update quantity or change associations.</DialogDescription>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label>Product</Label>
                <AsyncSearchableCombobox
                  value={(editItem.product?.id ?? editItem.product_id ?? "").toString()}
                  onChange={(v) => setEditItem((s) => (s ? { ...s, product: { id: Number(v), name: getProductName(v) || "" } } : s))}
                  fetchItems={fetchProductsForDropdown}
                  isLoading={isLoadingProducts}
                  getItemName={getProductNameAsync}
                  placeholder="Select product"
                />
              </div>
              <div className="grid gap-2">
                <Label>Warehouse</Label>
                <SearchableCombobox
                  value={(editItem.warehouse?.id ?? editItem.warehouse_id ?? "").toString()}
                  onChange={(v) => setEditItem((s) => (s ? { ...s, warehouse: { id: Number(v), name: getWarehouseName(v) || "" } } : s))}
                  items={warehouseOptions}
                  placeholder="Select warehouse"
                />
              </div>
              <div className="grid gap-2">
                <Label>Quantity</Label>
                <Input type="number" value={editItem.quantity} onChange={(e) => setEditItem((s) => (s ? { ...s, quantity: Number(e.target.value || 0) } : s))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteId !== null && (
                <>
                  You are about to delete inventory entry <strong>#{deleteId}</strong>. This action cannot be undone.
                  <div className="mt-4">
                    <Label htmlFor="confirm-delete">Type "DELETE" to confirm</Label>
                    <Input id="confirm-delete" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="mt-2" />
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteConfirm !== "DELETE" || isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
    </ErrorBoundary>
  )
}


