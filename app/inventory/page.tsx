"use client"

import { PageBreadcrumb, useAppCrumbs } from "@/components/page-breadcrumb"
import { DocumentTitle } from "@/components/document-title"
import { useLanguage } from "@/components/language-context"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { fetchWithRetry } from "@/lib/apiClient"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
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
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/table-skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

function WarehouseSearchableCombobox({
  value,
  onChange,
  placeholder,
  items,
  allowAll = false,
  onOpen,
}: {
  value: string | number | undefined
  onChange: (value: string) => void
  placeholder: string
  items: { id: number; name: string }[]
  allowAll?: boolean
  onOpen?: () => void
}) {
  const [open, setOpen] = useState(false)
  const currentLabel =
    value && value !== "all"
      ? items.find((item) => item.id === Number(value))?.name
      : undefined

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) onOpen?.()
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {currentLabel || (value === "all" ? placeholder : placeholder)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {allowAll ? (
                <CommandItem
                  value="all"
                  onSelect={() => {
                    onChange("all")
                    setOpen(false)
                  }}
                >
                  {placeholder}
                </CommandItem>
              ) : null}
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.name} ${item.id}`}
                  onSelect={() => {
                    onChange(String(item.id))
                    setOpen(false)
                  }}
                >
                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function InventoryManagementPage() {
  const { t } = useLanguage()
  const { dashboard: dashboardCrumb } = useAppCrumbs()
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
              const cachedWarehouses = JSON.parse(cachedData)
              // Render cached values immediately, but always continue with a
              // network refresh so newly-created warehouses are not hidden.
              setWarehouses(Array.isArray(cachedWarehouses) ? cachedWarehouses : [])
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
        toast.error(t("toasts.error"), { description: t("toasts.authRequired") })
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
      toast.error(t("toasts.error"), { description: t("toasts.loadWarehousesFailed") })
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
      toast.error(t("toasts.error"), { description: t("inventoryToasts.loadFailed") })
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
        toast.error(t("toasts.error"), { description: t("inventoryToasts.selectWarehouse") })
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
        toast.success(t("inventoryToasts.saved"), { description: message })
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
      toast.success(t("inventoryToasts.saved"), { description: t("inventoryToasts.savedDesc") })
        // Refresh to ensure consistency
        await fetchInventory(currentPage, pageSize)
      } else {
        toast.error(t("toasts.error"), { description: t("toasts.selectProduct") })
        setIsCreating(false)
      }
    } catch (e) {
      // Ignore abort errors
      if (e instanceof Error && e.name === 'AbortError') {
        setIsCreating(false)
        return
      }
      const msg = e instanceof Error ? e.message : "Failed to save inventory"
      toast.error(t("toasts.error"), { description: msg })
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
      
      toast.success(t("inventoryToasts.updated"), { description: t("inventoryToasts.updatedDesc") })
      // Refresh to ensure consistency
      await fetchInventory(currentPage, pageSize)
    } catch (e) {
      // Ignore abort errors
      if (e instanceof Error && e.name === 'AbortError') {
        setIsUpdating(false)
        return
      }
      const msg = e instanceof Error ? e.message : "Failed to update inventory"
      toast.error(t("toasts.error"), { description: msg })
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
        const text = await res.text().catch(() => "")
        throw new Error(`Delete failed (${res.status}) for ${res.url}: ${text.slice(0, 200)}`)
      }
      
      toast.success(t("inventoryToasts.deleted"), { description: t("inventoryToasts.deletedDesc") })
      
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
      toast.error(t("toasts.error"), { description: msg })
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

  // Memoized lookup Maps for O(1) access
  const productMap = useMemo(() => {
    const map = new Map<number, Product>()
    products.forEach((p) => {
      map.set(p.id, p)
    })
    return map
  }, [products])

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((warehouse) => ({
        id: warehouse.id,
        name: warehouse.name_en || warehouse.name || String(warehouse.id),
      })),
    [warehouses],
  )

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
      
      toast.success(t("inventoryToasts.rowSaved"), { description: t("inventoryToasts.updated") })
      // Refresh to ensure consistency
      await fetchInventory(currentPage, pageSize)
    } catch (e) {
      // Ignore abort errors
      if (e instanceof Error && e.name === 'AbortError') {
        setIsUpdatingRow(null)
        return
      }
      const msg = e instanceof Error ? e.message : "Failed to save"
      toast.error(t("toasts.error"), { description: msg })
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
        toast.success(t("inventoryToasts.noChanges"), { description: t("inventoryToasts.noChangesDesc") })
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

      toast.success(t("inventoryToasts.allSaved"), {
        description: t("inventoryToasts.allSavedDesc", { count: results.length }),
        duration: 4000,
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
      toast.error(t("toasts.error"), { description: msg })
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

  return (
    <ErrorBoundary>
      <DocumentTitle title={t("inventory.title")} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[dashboardCrumb, { label: t("inventory.title") }]} />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">

          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">{t("inventory.management")}</h2>
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
                    <PlusCircle className="h-4 w-4 mr-2" /> {t("inventory.add")}
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
                    <DialogTitle>{t("inventory.add")}</DialogTitle>
                    <DialogDescription>
                      Select multiple products and set inventory quantity for a warehouse. All selected products will be created with the same quantity.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                      <Label>{t("inventory.product")}</Label>
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
                      <Label>{t("inventory.warehouse")} *</Label>
                      <WarehouseSearchableCombobox
                        value={newInventory.warehouse_id?.toString()}
                        onChange={(v) => setNewInventory((s) => ({ ...s, warehouse_id: Number(v) }))}
                        items={warehouseOptions}
                        placeholder={t("inventory.warehouse")}
                        onOpen={() => void fetchLookups(undefined, true)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("inventory.quantity")} *</Label>
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
                      {t("common.cancel")}
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
                    <Label>{t("transfer.products")}</Label>
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
                    <Label>{t("inventory.warehouse")}</Label>
                    <WarehouseSearchableCombobox
                      value={filterWarehouseId || "all"}
                      onChange={(v) => setFilterWarehouseId(v === "all" ? "" : v)}
                      items={warehouseOptions}
                      placeholder={t("common.allWarehouses")}
                      allowAll
                      onOpen={() => void fetchLookups(undefined, true)}
                    />
                  </div>
                  <div className="flex gap-2 items-end">
                    <Button disabled={isSavingAll} onClick={() => { 
                      if (selectedProductIds.length === 0 && !filterWarehouseId) { 
                        toast.success(t("inventoryToasts.selectFilter"), { description: t("inventoryToasts.selectFilterDesc") })
                        return
                      }
                      setHasRequested(true)
                      setCurrentPage(1) // Reset to first page on new search
                      void fetchInventory(1, pageSize)
                    }}>{t("common.search")}</Button>
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
                      {t("common.reset")}
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
                    {isSavingAll ? t("common.loading") : t("common.saveChanges")}
                  </Button>
                </div>
              )}

              <div className="p-4">
                  <div
                    className="overflow-x-auto"
                    ref={tableContainerRef}
                    style={{
                      height: shouldVirtualize ? '600px' : 'auto',
                      overflowY: shouldVirtualize ? 'auto' : 'visible',
                      position: 'relative'
                    }}
                  >
                  <Table disableWrapper>
                      <TableHeader className={shouldVirtualize ? "sticky top-0 bg-background z-10" : ""}>
                      <TableRow>
                          <TableHead 
                            className="cursor-pointer select-none"
                            onClick={() => handleSort("product")}
                          >
                            <div className="flex items-center">
                              {t("inventory.product")}
                              {getSortIndicator("product")}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer select-none"
                            onClick={() => handleSort("warehouse")}
                          >
                            <div className="flex items-center">
                              {t("inventory.warehouse")}
                              {getSortIndicator("warehouse")}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer select-none"
                            onClick={() => handleSort("quantity")}
                          >
                            <div className="flex items-center">
                              {t("inventory.quantity")}
                              {getSortIndicator("quantity")}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer select-none"
                            onClick={() => handleSort("updated_at")}
                          >
                            <div className="flex items-center">
                              {t("inventory.updatedAt")}
                              {getSortIndicator("updated_at")}
                            </div>
                          </TableHead>
                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                      <TableBody style={{ position: 'relative', height: shouldVirtualize && totalSize > 0 ? `${totalSize}px` : 'auto' }}>
                      {!hasRequested ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                              Select product or warehouse and click Search to load inventory
                          </TableCell>
                        </TableRow>
                      ) : isLoading ? (
                          <TableSkeleton columns={5} rows={5} hasActions />
                      ) : mergedRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center">
                            {t("inventory.empty")}
                          </TableCell>
                        </TableRow>
                        ) : shouldVirtualize && virtualItems.length > 0 ? (
                          <>
                            {/* Spacer for items before the first visible item */}
                            <TableRow>
                              <TableCell colSpan={5} style={{ height: virtualItems[0]?.start ?? 0 }} />
                            </TableRow>
                            {/* Render only visible items */}
                            {virtualItems.map((virtualItem) => {
                              const inv = mergedRows[virtualItem.index]
                              if (!inv) return null
                              return (
                                <TableRow
                                  key={inv.id}
                                  data-index={virtualItem.index}
                                  ref={rowVirtualizer.measureElement}
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
                                  <TableCell className="font-medium">{getInventoryProductLabel(inv)}</TableCell>
                                  <TableCell>{getInventoryWarehouseLabel(inv)}</TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      className="h-8 w-24"
                                      value={getDraftQty(inv)}
                                      onChange={(e) => setDraftForRow(inv, Number(e.target.value || 0))}
                                    />
                                  </TableCell>
                                  <TableCell>{formatDateUTC(inv.updated_at)}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <div className="hidden sm:flex gap-2">
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEditDialog(inv)} disabled={isUpdating || isDeleting}>
                                          <Edit className="h-4 w-4" />
                                          <span className="sr-only">{t("common.edit")}</span>
                                        </Button>
                                        <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(inv.id)} disabled={isUpdating || isDeleting}>
                                          <Trash2 className="h-4 w-4" />
                                          <span className="sr-only">{t("common.delete")}</span>
                                        </Button>
                                      </div>
                                      <div className="sm:hidden">
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="icon" className="h-8 w-8">
                                              <MoreHorizontal className="h-4 w-4" />
                                              <span className="sr-only">{t("common.actions")}</span>
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => openEditDialog(inv)} disabled={isUpdating || isDeleting}>
                                              <Edit className="h-4 w-4 mr-2" /> {t("common.edit")}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(inv.id)} disabled={isUpdating || isDeleting}>
                                              <Trash2 className="h-4 w-4 mr-2" /> {t("common.delete")}
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </>
                        ) : (
                          // Non-virtualized rendering for small lists
                        mergedRows.map((inv: any) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-medium">{getInventoryProductLabel(inv)}</TableCell>
                            <TableCell>{getInventoryWarehouseLabel(inv)}</TableCell>
                            <TableCell>
                                <Input
                                  type="number"
                                  className="h-8 w-24"
                                  value={getDraftQty(inv)}
                                  onChange={(e) => setDraftForRow(inv, Number(e.target.value || 0))}
                                />
                            </TableCell>
                            <TableCell>{formatDateUTC(inv.updated_at)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <div className="hidden sm:flex gap-2">
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEditDialog(inv)} disabled={isUpdating || isDeleting}>
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">{t("common.edit")}</span>
                                  </Button>
                                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(inv.id)} disabled={isUpdating || isDeleting}>
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">{t("common.delete")}</span>
                                  </Button>
                                </div>
                                <div className="sm:hidden">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">{t("common.actions")}</span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => openEditDialog(inv)} disabled={isUpdating || isDeleting}>
                                        <Edit className="h-4 w-4 mr-2" /> {t("common.edit")}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(inv.id)} disabled={isUpdating || isDeleting}>
                                        <Trash2 className="h-4 w-4 mr-2" /> {t("common.delete")}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
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
            <DialogTitle>{t("common.edit")}</DialogTitle>
            <DialogDescription>Update quantity or change associations.</DialogDescription>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label>{t("inventory.product")}</Label>
                <AsyncSearchableCombobox
                  value={(editItem.product?.id ?? editItem.product_id ?? "").toString()}
                  onChange={(v) => setEditItem((s) => (s ? { ...s, product: { id: Number(v), name: getProductName(v) || "" } } : s))}
                  fetchItems={fetchProductsForDropdown}
                  isLoading={isLoadingProducts}
                  getItemName={getProductNameAsync}
                  placeholder={t("inventory.product")}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("inventory.warehouse")}</Label>
                <WarehouseSearchableCombobox
                  value={(editItem.warehouse?.id ?? editItem.warehouse_id ?? "").toString()}
                  onChange={(v) => setEditItem((s) => (s ? { ...s, warehouse: { id: Number(v), name: getWarehouseName(v) || "" } } : s))}
                  items={warehouseOptions}
                  placeholder={t("inventory.warehouse")}
                  onOpen={() => void fetchLookups(undefined, true)}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("inventory.quantity")}</Label>
                <Input type="number" value={editItem.quantity} onChange={(e) => setEditItem((s) => (s ? { ...s, quantity: Number(e.target.value || 0) } : s))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleEdit} disabled={isUpdating}>
              {isUpdating ? t("common.loading") : t("common.saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        description={
          deleteId !== null ? (
            <>
              You are about to delete inventory entry <strong>#{deleteId}</strong>. This action cannot be undone.
            </>
          ) : (
            ""
          )
        }
        isDeleting={isDeleting}
        onConfirm={handleDelete}
      />
</ErrorBoundary>
  )
}


