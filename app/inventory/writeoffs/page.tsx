"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  ChevronsUpDown,
  ClipboardList,
  Loader2,
  X,
} from "lucide-react"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { DocumentTitle } from "@/components/document-title"
import { PageBreadcrumb, useAppCrumbs } from "@/components/page-breadcrumb"
import { useLanguage } from "@/components/language-context"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { fetchWithRetry } from "@/lib/apiClient"
import { API_URL } from "@/lib/config"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Warehouse = { id: number; name_en: string; name_ar?: string }
type ProductOption = {
  id: number
  isbn?: string
  title_en?: string
  title_ar?: string
  name?: string
}
type WriteoffType = "damage" | "loss" | "reserved"
type ListItemOption = {
  id: number
  value: string
  display_name_en: string
  display_name_ar: string
  is_active?: boolean
}
type WriteoffRow = {
  id: number
  product_title: string | null
  isbn: string | null
  warehouse_name: string | null
  movement_type: WriteoffType | string
  quantity: number
  reason: string
  occurred_at: string | null
  created_by: string | null
}
type SelectedItem = { product: ProductOption; quantity: string }
/** Per-product stock for the current warehouse; "loading" while fetching. */
type StockState = number | null | "loading"

const ALLOWED_TYPES = new Set(["damage", "loss", "reserved"])

function productLabel(p: ProductOption) {
  const title = p.title_en || p.title_ar || p.name || `Product ${p.id}`
  return p.isbn ? `${title} (${p.isbn})` : title
}

export default function StockWriteoffsPage() {
  const { t, language } = useLanguage()
  const crumbs = useAppCrumbs()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [reasonOptions, setReasonOptions] = useState<ListItemOption[]>([])
  const [productOpen, setProductOpen] = useState(false)
  const [productQuery, setProductQuery] = useState("")
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)

  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [stockMap, setStockMap] = useState<Record<number, StockState>>({})
  const [failedProductId, setFailedProductId] = useState<number | null>(null)

  const [warehouseId, setWarehouseId] = useState<string>("")
  const [reasonItemId, setReasonItemId] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [rows, setRows] = useState<WriteoffRow[]>([])
  const [isLoadingRows, setIsLoadingRows] = useState(false)

  const productAbortRef = useRef<AbortController | null>(null)
  // Guards against stale stock responses after the warehouse changes.
  const warehouseRef = useRef("")

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("accessToken") : ""}`,
    }),
    [],
  )

  const selectedReason = useMemo(
    () => reasonOptions.find((item) => String(item.id) === reasonItemId) || null,
    [reasonOptions, reasonItemId],
  )

  const reasonLabel = useCallback(
    (item: ListItemOption) =>
      language === "ar"
        ? item.display_name_ar || item.display_name_en || item.value
        : item.display_name_en || item.display_name_ar || item.value,
    [language],
  )

  const typeLabel = useCallback(
    (type: string) => {
      const fromList = reasonOptions.find((item) => item.value === type)
      if (fromList) return reasonLabel(fromList)
      if (type === "damage") return t("writeoffs.damage")
      if (type === "loss") return t("writeoffs.loss")
      if (type === "reserved") return t("writeoffs.reserved")
      return type
    },
    [reasonOptions, reasonLabel, t],
  )

  const isAnyStockLoading = useMemo(
    () => selectedItems.some((item) => stockMap[item.product.id] === "loading"),
    [selectedItems, stockMap],
  )
  const totalQuantity = useMemo(
    () =>
      selectedItems.reduce((sum, item) => {
        const qty = Number(item.quantity)
        return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0)
      }, 0),
    [selectedItems],
  )

  const loadRows = useCallback(async () => {
    setIsLoadingRows(true)
    try {
      const res = await fetchWithRetry(
        `${API_URL}/inventory/stock-writeoffs/?page_size=25`,
        { headers },
      )
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      const data = await res.json()
      setRows((data.results || []) as WriteoffRow[])
    } catch {
      setRows([])
    } finally {
      setIsLoadingRows(false)
    }
  }, [headers])

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const [warehousesRes, reasonsRes] = await Promise.all([
          fetchWithRetry(`${API_URL}/inventory/warehouses/?page_size=100`, {
            headers,
            signal: controller.signal,
          }),
          fetchWithRetry(`${API_URL}/common/list-items/movement_type/`, {
            headers,
            signal: controller.signal,
          }),
        ])
        if (warehousesRes.ok) {
          const data = await warehousesRes.json()
          setWarehouses(Array.isArray(data) ? data : data.results || [])
        }
        if (reasonsRes.ok) {
          const data = await reasonsRes.json()
          const items = (Array.isArray(data) ? data : data.results || []) as ListItemOption[]
          setReasonOptions(
            items.filter(
              (item) =>
                item.is_active !== false && ALLOWED_TYPES.has((item.value || "").trim()),
            ),
          )
        }
      } catch {
        /* ignore abort */
      }
    })()
    void loadRows()
    return () => controller.abort()
  }, [headers, loadRows])

  useEffect(() => {
    if (!productOpen) return
    const timer = setTimeout(() => {
      productAbortRef.current?.abort()
      productAbortRef.current = new AbortController()
      const signal = productAbortRef.current.signal
      setIsSearchingProducts(true)
      const params = new URLSearchParams({ page_size: "30", page: "1" })
      if (productQuery.trim()) params.set("search", productQuery.trim())
      void fetchWithRetry(`${API_URL}/inventory/product-summary/?${params}`, {
        headers,
        signal,
      })
        .then(async (res) => {
          if (!res.ok) return []
          const data = await res.json()
          return (Array.isArray(data) ? data : data.results || []) as ProductOption[]
        })
        .then((items) => {
          if (!signal.aborted) setProductOptions(items)
        })
        .catch(() => {
          if (!signal.aborted) setProductOptions([])
        })
        .finally(() => {
          if (!signal.aborted) setIsSearchingProducts(false)
        })
    }, 250)
    return () => clearTimeout(timer)
  }, [productOpen, productQuery, headers])

  const loadStock = useCallback(
    async (productId: number, wid: string) => {
      setStockMap((prev) => ({ ...prev, [productId]: "loading" }))
      let qty: number | null = null
      try {
        const params = new URLSearchParams({
          product_id: String(productId),
          warehouse_id: wid,
          page_size: "10",
        })
        const res = await fetchWithRetry(`${API_URL}/inventory/inventory/?${params}`, {
          headers,
        })
        if (res.ok) {
          const data = await res.json()
          const list = Array.isArray(data) ? data : data.results || []
          const match =
            list.find(
              (row: { product_id?: number; warehouse_id?: number; product?: { id?: number }; warehouse?: { id?: number } }) =>
                (row.product_id === productId || row.product?.id === productId) &&
                (row.warehouse_id === Number(wid) || row.warehouse?.id === Number(wid)),
            ) ?? list[0]
          qty = typeof match?.quantity === "number" ? match.quantity : 0
        }
      } catch {
        qty = null
      }
      if (warehouseRef.current !== wid) return
      setStockMap((prev) => ({ ...prev, [productId]: qty }))
    },
    [headers],
  )

  const handleWarehouseChange = (wid: string) => {
    setWarehouseId(wid)
    warehouseRef.current = wid
    setStockMap({})
    setFailedProductId(null)
    selectedItems.forEach((item) => void loadStock(item.product.id, wid))
  }

  const toggleProduct = (product: ProductOption) => {
    setFailedProductId(null)
    const exists = selectedItems.some((item) => item.product.id === product.id)
    if (exists) {
      removeProduct(product.id)
      return
    }
    setSelectedItems((prev) => [...prev, { product, quantity: "" }])
    if (warehouseRef.current) void loadStock(product.id, warehouseRef.current)
  }

  const removeProduct = (productId: number) => {
    setSelectedItems((prev) => prev.filter((item) => item.product.id !== productId))
    setStockMap((prev) => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
    if (failedProductId === productId) setFailedProductId(null)
  }

  const updateQuantity = (productId: number, value: string) => {
    setSelectedItems((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: value } : item)),
    )
  }

  const validateForm = () => {
    if (selectedItems.length === 0) {
      toast.error(t("writeoffs.selectBookFirst"))
      return null
    }
    if (!warehouseId) {
      toast.error(t("writeoffs.selectWarehouseFirst"))
      return null
    }
    if (!selectedReason || !ALLOWED_TYPES.has(selectedReason.value)) {
      toast.error(t("writeoffs.reasonRequired"))
      return null
    }
    const items: { product_id: number; quantity: number }[] = []
    for (const item of selectedItems) {
      const book = productLabel(item.product)
      const qty = Number(item.quantity)
      if (!Number.isInteger(qty) || qty <= 0) {
        toast.error(t("writeoffs.bookQuantityInvalid", { book }))
        return null
      }
      const stock = stockMap[item.product.id]
      if (typeof stock !== "number") {
        toast.error(t("writeoffs.bookStockUnknown", { book }))
        return null
      }
      if (qty > stock) {
        toast.error(t("writeoffs.bookQuantityExceeds", { book, stock: String(stock) }))
        return null
      }
      items.push({ product_id: item.product.id, quantity: qty })
    }
    return {
      items,
      warehouseId: Number(warehouseId),
      movementType: selectedReason.value as WriteoffType,
      reasonText: reasonLabel(selectedReason),
    }
  }

  const handleSaveClick = () => {
    if (!validateForm()) return
    setConfirmOpen(true)
  }

  const handleConfirmSave = async () => {
    const payload = validateForm()
    if (!payload) {
      setConfirmOpen(false)
      return
    }

    setIsSaving(true)
    setFailedProductId(null)
    try {
      const res = await fetchWithRetry(`${API_URL}/inventory/stock-writeoffs/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          warehouse_id: payload.warehouseId,
          movement_type: payload.movementType,
          reason: payload.reasonText,
          items: payload.items,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (typeof data.product_id === "number") setFailedProductId(data.product_id)
        throw new Error(typeof data.detail === "string" ? data.detail : t("writeoffs.saveFailed"))
      }
      const savedQty = payload.items.reduce((sum, item) => sum + item.quantity, 0)
      toast.success(t("writeoffs.saved"), {
        description: t("writeoffs.savedBatchDesc", {
          qty: String(savedQty),
          count: String(payload.items.length),
        }),
      })
      setSelectedItems([])
      setStockMap({})
      setReasonItemId("")
      setConfirmOpen(false)
      void loadRows()
    } catch (error) {
      setConfirmOpen(false)
      toast.error(t("writeoffs.saveFailed"), {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ErrorBoundary>
      <DocumentTitle title={t("writeoffs.title")} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb
              items={[crumbs.dashboard, { label: t("writeoffs.title") }]}
            />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="rounded-xl bg-muted/50 p-6">
            <div className="mb-6 flex items-start gap-3">
              <ClipboardList className="mt-1 h-6 w-6 text-muted-foreground" />
              <div>
                <h2 className="text-xl font-semibold">{t("writeoffs.title")}</h2>
                <p className="text-muted-foreground">{t("writeoffs.description")}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("writeoffs.warehouse")}</Label>
                <Select value={warehouseId} onValueChange={handleWarehouseChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("writeoffs.selectWarehouse")} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("writeoffs.reason")}</Label>
                <Select value={reasonItemId} onValueChange={setReasonItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("writeoffs.selectReason")} />
                  </SelectTrigger>
                  <SelectContent>
                    {reasonOptions.length === 0 ? (
                      <SelectItem value="__empty" disabled>
                        {t("writeoffs.noReasons")}
                      </SelectItem>
                    ) : (
                      reasonOptions.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {reasonLabel(item)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>{t("writeoffs.book")}</Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate text-muted-foreground">
                        {t("writeoffs.addBooks")}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder={t("writeoffs.searchBook")}
                        value={productQuery}
                        onValueChange={setProductQuery}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {isSearchingProducts
                            ? t("common.loading")
                            : t("writeoffs.noBook")}
                        </CommandEmpty>
                        <CommandGroup>
                          {productOptions.map((product) => {
                            const isSelected = selectedItems.some(
                              (item) => item.product.id === product.id,
                            )
                            return (
                              <CommandItem
                                key={product.id}
                                value={String(product.id)}
                                onSelect={() => toggleProduct(product)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    isSelected ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                {productLabel(product)}
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="mt-4 rounded-md border bg-background">
              <div className="flex items-center justify-between border-b px-4 py-2">
                <span className="text-sm font-medium">
                  {t("writeoffs.selectedBooks", { count: String(selectedItems.length) })}
                </span>
                {selectedItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedItems([])
                      setStockMap({})
                      setFailedProductId(null)
                    }}
                    disabled={isSaving}
                  >
                    {t("writeoffs.clearAll")}
                  </Button>
                )}
              </div>
              {selectedItems.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  {t("writeoffs.noBooksSelected")}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("writeoffs.book")}</TableHead>
                      <TableHead className="w-[140px]">{t("writeoffs.available")}</TableHead>
                      <TableHead className="w-[140px]">{t("writeoffs.quantity")}</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedItems.map((item) => {
                      const stock = stockMap[item.product.id]
                      const qty = Number(item.quantity)
                      const exceeds =
                        typeof stock === "number" && Number.isFinite(qty) && qty > stock
                      return (
                        <TableRow
                          key={item.product.id}
                          className={cn(failedProductId === item.product.id && "bg-destructive/10")}
                        >
                          <TableCell>
                            <div className="min-w-0">
                              <p className="truncate">
                                {item.product.title_en || item.product.title_ar || item.product.name || `Product ${item.product.id}`}
                              </p>
                              {item.product.isbn && (
                                <p className="text-xs text-muted-foreground">{item.product.isbn}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {!warehouseId ? (
                              <span className="text-muted-foreground">
                                {t("writeoffs.selectWarehouseForStock")}
                              </span>
                            ) : stock === "loading" || stock === undefined ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : stock === null ? (
                              <span className="text-destructive">—</span>
                            ) : (
                              stock
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              max={typeof stock === "number" ? stock : undefined}
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.product.id, e.target.value)}
                              className={cn("h-8", exceeds && "border-destructive")}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeProduct(item.product.id)}
                              disabled={isSaving}
                              aria-label={t("writeoffs.remove")}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="mt-4">
              <Button
                onClick={handleSaveClick}
                disabled={isSaving || isAnyStockLoading || selectedItems.length === 0}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("writeoffs.save")}
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("writeoffs.recent")}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              {isLoadingRows ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </div>
              ) : rows.length === 0 ? (
                <p className="text-muted-foreground">{t("writeoffs.empty")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("writeoffs.date")}</TableHead>
                      <TableHead>{t("writeoffs.book")}</TableHead>
                      <TableHead>{t("writeoffs.warehouse")}</TableHead>
                      <TableHead>{t("writeoffs.reason")}</TableHead>
                      <TableHead className="text-right">{t("writeoffs.quantity")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          {row.occurred_at
                            ? new Date(row.occurred_at).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{row.product_title || "—"}</p>
                            {row.isbn && (
                              <p className="text-xs text-muted-foreground">{row.isbn}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{row.warehouse_name || "—"}</TableCell>
                        <TableCell>
                          {row.reason || typeLabel(row.movement_type)}
                        </TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("writeoffs.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("writeoffs.confirmSummary", {
                count: String(selectedItems.length),
                qty: String(totalQuantity),
              })}{" "}
              {t("writeoffs.confirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmSave()
              }}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("writeoffs.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ErrorBoundary>
  )
}
