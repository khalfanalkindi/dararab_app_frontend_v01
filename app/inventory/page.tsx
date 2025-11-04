"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
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
import { Edit, Trash2, MoreHorizontal, PlusCircle, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

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
  created_at?: string
  updated_at?: string
}

// Use the same API base as login page
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

export default function InventoryManagementPage() {
  const [mounted, setMounted] = useState<boolean>(false)
  const [items, setItems] = useState<Inventory[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [hasRequested, setHasRequested] = useState<boolean>(false)
  const [count, setCount] = useState<number>(0)

  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  const [filterProductId, setFilterProductId] = useState<string>("")
  const [filterWarehouseId, setFilterWarehouseId] = useState<string>("")

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

  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error" | "warning" | null; message: string }>({ type: null, message: "" })
  const [draftQtyByKey, setDraftQtyByKey] = useState<Record<string, number>>({})

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("accessToken") : ""}`,
    }),
    []
  )

  const showAlert = (type: "success" | "error" | "warning", message: string) => {
    setAlertMsg({ type, message })
    setTimeout(() => setAlertMsg({ type: null, message: "" }), 5000)
  }

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
    void fetchLookups()
  }, [])

  const buildQuery = () => {
    const params = new URLSearchParams()
    if (filterProductId) params.set("product_id", filterProductId)
    if (filterWarehouseId) params.set("warehouse_id", filterWarehouseId)
    return params.toString()
  }

  const fetchLookups = async () => {
    try {
      const [pRes, wRes] = await Promise.all([
        fetch(`${API_URL}/inventory/products/?page_size=1000`, { headers: authHeaders }),
        fetch(`${API_URL}/inventory/warehouses/?page_size=1000`, { headers: authHeaders }),
      ])
      const ensureJson = async (res: Response) => {
        const ct = res.headers.get("content-type") || ""
        if (!ct.includes("application/json")) {
          const text = await res.text()
          throw new Error(`Lookup request failed (${res.status}) for ${res.url}: ${text.slice(0, 200)}`)
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
      // Debug in dev only
      if (process.env.NODE_ENV !== "production") {
        console.info("Products fetched:", pList.length, Array.isArray(pData?.results) ? "results" : Array.isArray(pData) ? "array" : Object.keys(pData || {}))
        console.info("Warehouses fetched:", wList.length, Array.isArray(wData?.results) ? "results" : Array.isArray(wData) ? "array" : Object.keys(wData || {}))
      }
      setProducts(pList)
      setWarehouses(wList)
    } catch (e) {
      console.error("Lookup fetch failed", e)
      showAlert("error", "Failed to load products/warehouses")
    }
  }

  const fetchInventory = async () => {
    setIsLoading(true)
    try {
      const qs = buildQuery()
      const res = await fetch(`${API_URL}/inventory/inventory/${qs ? `?${qs}` : ""}`, { headers: authHeaders })
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
      setCount(typeof data?.count === "number" ? data.count : Array.isArray(list) ? list.length : 0)
    } catch (e) {
      console.error("Fetch inventory failed", e)
      setItems([])
      setCount(0)
      showAlert("error", "Failed to load inventory list")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const body = {
        product_id: Number(newInventory.product_id),
        warehouse_id: Number(newInventory.warehouse_id),
        quantity: Number(newInventory.quantity ?? 0),
      }
      const res = await fetch(`${API_URL}/inventory/inventory/`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
      })
      const ct = res.headers.get("content-type") || ""
      if (!res.ok || !ct.includes("application/json")) {
        const text = await res.text()
        throw new Error(`Create failed (${res.status}) for ${res.url}: ${text.slice(0, 200)}`)
      }
      const data = await res.json()

      setIsAddOpen(false)
      setNewInventory({ product_id: undefined, warehouse_id: undefined, quantity: 0 })
      toast({ title: "Inventory saved", description: "Entry created/updated successfully" })
      showAlert("success", "Inventory saved successfully")
      await fetchInventory()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save inventory"
      toast({ title: "Error", description: msg, variant: "destructive" })
      showAlert("error", msg)
    }
  }

  const handleEdit = async () => {
    if (!editItem) return
    try {
      const res = await fetch(`${API_URL}/inventory/inventory/${editItem.id}/`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          product_id: editItem.product?.id ?? editItem.product_id,
          warehouse_id: editItem.warehouse?.id ?? editItem.warehouse_id,
          quantity: Number(editItem.quantity),
        }),
      })
      const ct = res.headers.get("content-type") || ""
      if (!res.ok || !ct.includes("application/json")) {
        const text = await res.text()
        throw new Error(`Update failed (${res.status}) for ${res.url}: ${text.slice(0, 200)}`)
      }
      const data = await res.json()
      setIsEditOpen(false)
      setEditItem(null)
      toast({ title: "Inventory updated", description: "Entry updated successfully" })
      showAlert("success", "Inventory updated successfully")
      await fetchInventory()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update inventory"
      toast({ title: "Error", description: msg, variant: "destructive" })
      showAlert("error", msg)
    }
  }

  const handleDelete = async () => {
    if (deleteId == null) return
    try {
      const res = await fetch(`${API_URL}/inventory/inventory/${deleteId}/delete/`, {
        method: "DELETE",
        headers: authHeaders,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(`Delete failed (${res.status}) for ${res.url}: ${text.slice(0, 200)}`)
      }
      setIsDeleteOpen(false)
      setDeleteId(null)
      setDeleteConfirm("")
      toast({ title: "Inventory deleted", variant: "destructive" })
      showAlert("warning", "Inventory entry deleted")
      await fetchInventory()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete inventory"
      toast({ title: "Error", description: msg, variant: "destructive" })
      showAlert("error", msg)
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

  const productOptions = useMemo(
    () => products.map((p) => ({ id: p.id, name: p.title_en || (p as any).name || String(p.id) })),
    [products]
  )

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ id: w.id, name: w.name_en || (w as any).name || String(w.id) })),
    [warehouses]
  )

  // Build merged rows so that a selected warehouse shows all products (zero quantity when missing)
  const mergedRows = useMemo(() => {
    // Helper to normalize ids from item
    const extractIds = (inv: any) => {
      const productId = typeof inv.product === "number" ? inv.product : inv.product?.id
      const warehouseId = typeof inv.warehouse === "number" ? inv.warehouse : inv.warehouse?.id
      return { productId, warehouseId }
    }

    if (!hasRequested) return []

    // If warehouse is selected, show all products for that warehouse
    if (filterWarehouseId && !filterProductId) {
      const wid = Number(filterWarehouseId)
      const warehouseObj = warehouses.find((w) => w.id === wid)
      const existingByProduct = new Map<number, any>()
      items.forEach((inv: any) => {
        const { productId, warehouseId } = extractIds(inv)
        if (warehouseId === wid && productId) existingByProduct.set(productId, inv)
      })
      return products.map((p) => {
        const found = existingByProduct.get(p.id)
        if (found) return found
        // Synthesize zero-qty row
        return {
          id: 0,
          quantity: 0,
          product: { id: p.id, title_en: (p as any).title_en, name: (p as any).name },
          warehouse: warehouseObj ? { id: warehouseObj.id, name_en: (warehouseObj as any).name_en, name: (warehouseObj as any).name } : { id: wid },
          product_id: p.id,
          warehouse_id: wid,
          updated_at: undefined,
        } as any
      })
    }

    // If product is selected, show across all warehouses
    if (filterProductId && !filterWarehouseId) {
      const pid = Number(filterProductId)
      const productObj = products.find((p) => p.id === pid)
      const existingByWarehouse = new Map<number, any>()
      items.forEach((inv: any) => {
        const { productId, warehouseId } = extractIds(inv)
        if (productId === pid && warehouseId) existingByWarehouse.set(warehouseId, inv)
      })
      return warehouses.map((w) => {
        const found = existingByWarehouse.get(w.id)
        if (found) return found
        return {
          id: 0,
          quantity: 0,
          product: productObj ? { id: productObj.id, title_en: (productObj as any).title_en, name: (productObj as any).name } : { id: pid },
          warehouse: { id: w.id, name_en: (w as any).name_en, name: (w as any).name },
          product_id: pid,
          warehouse_id: w.id,
          updated_at: undefined,
        } as any
      })
    }

    // If both filters set, keep API list as-is (at most one row) or synthesize if empty
    if (filterProductId && filterWarehouseId) {
      if (items.length > 0) return items
      const pid = Number(filterProductId)
      const wid = Number(filterWarehouseId)
      const productObj = products.find((p) => p.id === pid)
      const warehouseObj = warehouses.find((w) => w.id === wid)
      return [
        {
          id: 0,
          quantity: 0,
          product: productObj ? { id: productObj.id, title_en: (productObj as any).title_en, name: (productObj as any).name } : { id: pid },
          warehouse: warehouseObj ? { id: warehouseObj.id, name_en: (warehouseObj as any).name_en, name: (warehouseObj as any).name } : { id: wid },
          product_id: pid,
          warehouse_id: wid,
          updated_at: undefined,
        } as any,
      ]
    }

    // Default: no synthesis
    return items
  }, [hasRequested, filterWarehouseId, filterProductId, items, products, warehouses])

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
    try {
      let res: Response
      if (inv.id && inv.id !== 0) {
        res = await fetch(`${API_URL}/inventory/inventory/${inv.id}/`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ quantity: Number(qty) }),
        })
      } else {
        // Upsert by POST
        res = await fetch(`${API_URL}/inventory/inventory/`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ product_id: Number(pid), warehouse_id: Number(wid), quantity: Number(qty) }),
        })
      }
      const ct = res.headers.get("content-type") || ""
      if (!res.ok || !ct.includes("application/json")) {
        const text = await res.text()
        throw new Error(`Save failed (${res.status}) for ${res.url}: ${text.slice(0, 200)}`)
      }
      toast({ title: "Saved", description: "Inventory updated" })
      await fetchInventory()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save"
      toast({ title: "Error", description: msg, variant: "destructive" })
    }
  }

  if (!mounted) {
    return null
  }

  const getProductName = (id?: number | string) => {
    const n = Number(id)
    const p = products.find((p) => p.id === n)
    return p?.title_en || (p as any)?.name || undefined
  }

  const getWarehouseName = (id?: number | string) => {
    const n = Number(id)
    const w = warehouses.find((w) => w.id === n)
    return w?.name_en || (w as any)?.name || undefined
  }

  const getInventoryProductLabel = (inv: Inventory) => {
    const prod: any = (inv as any).product
    if (!prod) return "-"
    if (typeof prod === "number") return getProductName(prod) || "-"
    return prod.title_en || prod.name || getProductName(prod.id) || "-"
  }

  const getInventoryWarehouseLabel = (inv: Inventory) => {
    const wh: any = (inv as any).warehouse
    if (!wh) return "-"
    if (typeof wh === "number") return getWarehouseName(wh) || "-"
    return wh.name_en || wh.name || getWarehouseName(wh.id) || "-"
  }

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
          {alertMsg.type && (
            <Alert variant={alertMsg.type === "warning" ? "destructive" : "default"} className={alertMsg.type === "success" ? "border-green-500 text-green-500" : ""}>
              {alertMsg.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle>{alertMsg.type === "success" ? "Success" : alertMsg.type === "warning" ? "Warning" : "Information"}</AlertTitle>
              <AlertDescription>{alertMsg.message}</AlertDescription>
            </Alert>
          )}

          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Inventory Management</h2>
                <p className="text-sm text-muted-foreground">Manage product stock per warehouse.</p>
              </div>
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground">
                    <PlusCircle className="h-4 w-4 mr-2" /> Add Inventory
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add / Upsert Inventory</DialogTitle>
                    <DialogDescription>Create or update inventory by product and warehouse.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                      <Label>Product</Label>
                      <SearchableCombobox
                        value={newInventory.product_id?.toString()}
                        onChange={(v) => setNewInventory((s) => ({ ...s, product_id: Number(v) }))}
                        items={productOptions}
                        placeholder="Select product"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Warehouse</Label>
                      <SearchableCombobox
                        value={newInventory.warehouse_id?.toString()}
                        onChange={(v) => setNewInventory((s) => ({ ...s, warehouse_id: Number(v) }))}
                        items={warehouseOptions}
                        placeholder="Select warehouse"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Quantity</Label>
                      <Input type="number" value={newInventory.quantity ?? 0} onChange={(e) => setNewInventory((s) => ({ ...s, quantity: Number(e.target.value || 0) }))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreate}>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="grid gap-2 md:grid-cols-3 md:gap-4 w-full">
                  <div className="grid gap-2">
                    <Label>Filter by Product</Label>
                    <SearchableCombobox
                      value={filterProductId || "all"}
                      onChange={(v) => setFilterProductId(v === "all" ? "" : v)}
                      items={productOptions}
                      placeholder="All products"
                      allowAll
                      onOpen={() => { if (!products.length) void fetchLookups() }}
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
                  <div className="flex gap-2 md:justify-end">
                    <Button variant="outline" onClick={() => { setFilterProductId(""); setFilterWarehouseId(""); setHasRequested(false); setItems([]); setCount(0) }}>
                      Reset
                    </Button>
                    <Button onClick={() => { 
                      if (!filterProductId && !filterWarehouseId) { 
                        toast({ title: "Select a filter", description: "Choose product or warehouse, then click Apply." })
                        return
                      }
                      setHasRequested(true)
                      void fetchInventory()
                    }}>Apply</Button>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-sm border-b">
                        <th className="text-left font-medium p-2">Product</th>
                        <th className="text-left font-medium p-2">Warehouse</th>
                        <th className="text-left font-medium p-2">Quantity</th>
                        <th className="text-left font-medium p-2">Updated At</th>
                        <th className="text-right font-medium p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!hasRequested ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            Select product or warehouse and click Apply to load inventory
                          </td>
                        </tr>
                      ) : isLoading ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center">
                            Loading inventory...
                          </td>
                        </tr>
                      ) : mergedRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center">
                            No inventory entries found
                          </td>
                        </tr>
                      ) : (
                        mergedRows.map((inv: any) => (
                          <tr key={inv.id} className="border-b last:border-0">
                            <td className="p-2 font-medium">{getInventoryProductLabel(inv)}</td>
                            <td className="p-2">{getInventoryWarehouseLabel(inv)}</td>
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  className="h-8 w-24"
                                  value={getDraftQty(inv)}
                                  onChange={(e) => setDraftForRow(inv, Number(e.target.value || 0))}
                                />
                                <Button size="sm" variant="outline" onClick={() => void saveRow(inv)}>
                                  Save
                                </Button>
                              </div>
                            </td>
                            <td className="p-2">{formatDateUTC(inv.updated_at)}</td>
                            <td className="p-2 text-right">
                              <div className="flex justify-end gap-2">
                                <div className="hidden sm:flex gap-2">
                                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEditDialog(inv)}>
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                  <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(inv.id)}>
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
                                      <DropdownMenuItem onClick={() => openEditDialog(inv)}>
                                        <Edit className="h-4 w-4 mr-2" /> Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(inv.id)}>
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

                {/* Simple count summary + pager placeholders if needed later */}
                {!isLoading && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">Total: {count}</div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled>
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
                <SearchableCombobox
                  value={(editItem.product?.id ?? editItem.product_id ?? "").toString()}
                  onChange={(v) => setEditItem((s) => (s ? { ...s, product: { id: Number(v), name: getProductName(v) || "" } } : s))}
                  items={productOptions}
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
            <Button onClick={handleEdit}>Save Changes</Button>
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteConfirm !== "DELETE"}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}


