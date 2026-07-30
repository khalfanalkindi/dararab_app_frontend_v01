"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  ChevronsUpDown,
  ClipboardList,
  Loader2,
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
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)

  const [warehouseId, setWarehouseId] = useState<string>("")
  const [reasonItemId, setReasonItemId] = useState<string>("")
  const [quantity, setQuantity] = useState("")
  const [availableStock, setAvailableStock] = useState<number | null>(null)
  const [isLoadingStock, setIsLoadingStock] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [rows, setRows] = useState<WriteoffRow[]>([])
  const [isLoadingRows, setIsLoadingRows] = useState(false)

  const productAbortRef = useRef<AbortController | null>(null)
  const stockAbortRef = useRef<AbortController | null>(null)

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

  useEffect(() => {
    if (!selectedProduct || !warehouseId) {
      setAvailableStock(null)
      return
    }
    stockAbortRef.current?.abort()
    stockAbortRef.current = new AbortController()
    const signal = stockAbortRef.current.signal
    setIsLoadingStock(true)
    const params = new URLSearchParams({
      product_id: String(selectedProduct.id),
      warehouse_id: warehouseId,
      page_size: "10",
    })
    void fetchWithRetry(`${API_URL}/inventory/inventory/?${params}`, {
      headers,
      signal,
    })
      .then(async (res) => {
        if (!res.ok) return null
        const data = await res.json()
        const rows = Array.isArray(data) ? data : data.results || []
        const match =
          rows.find(
            (row: { product_id?: number; warehouse_id?: number; product?: { id?: number }; warehouse?: { id?: number } }) =>
              (row.product_id === selectedProduct.id || row.product?.id === selectedProduct.id) &&
              (row.warehouse_id === Number(warehouseId) ||
                row.warehouse?.id === Number(warehouseId)),
          ) ?? rows[0]
        return typeof match?.quantity === "number" ? match.quantity : 0
      })
      .then((qty) => {
        if (!signal.aborted) setAvailableStock(qty)
      })
      .catch(() => {
        if (!signal.aborted) setAvailableStock(null)
      })
      .finally(() => {
        if (!signal.aborted) setIsLoadingStock(false)
      })
  }, [selectedProduct, warehouseId, headers])

  const validateForm = () => {
    if (!selectedProduct) {
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
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error(t("writeoffs.invalidQuantity"))
      return null
    }
    if (availableStock == null) {
      toast.error(t("writeoffs.stockUnknown"))
      return null
    }
    if (qty > availableStock) {
      toast.error(t("writeoffs.quantityExceedsStock"), {
        description: t("writeoffs.availableStock", { stock: String(availableStock) }),
      })
      return null
    }
    return {
      product: selectedProduct,
      warehouseId: Number(warehouseId),
      movementType: selectedReason.value as WriteoffType,
      reasonText: reasonLabel(selectedReason),
      qty,
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
    try {
      const res = await fetchWithRetry(`${API_URL}/inventory/stock-writeoffs/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          product_id: payload.product.id,
          warehouse_id: payload.warehouseId,
          movement_type: payload.movementType,
          quantity: payload.qty,
          reason: payload.reasonText,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : typeof data.quantity === "string"
              ? data.quantity
              : Array.isArray(data.quantity)
                ? data.quantity.join(", ")
                : t("writeoffs.saveFailed")
        throw new Error(detail)
      }
      toast.success(t("writeoffs.saved"), {
        description: t("writeoffs.savedDesc", {
          qty: String(payload.qty),
          stock: String(data.movement?.current_stock ?? ""),
        }),
      })
      setQuantity("")
      setReasonItemId("")
      setConfirmOpen(false)
      setAvailableStock(
        typeof data.movement?.current_stock === "number"
          ? data.movement.current_stock
          : availableStock,
      )
      void loadRows()
    } catch (error) {
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
              <div className="space-y-2 md:col-span-2">
                <Label>{t("writeoffs.book")}</Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      <span className="truncate">
                        {selectedProduct
                          ? productLabel(selectedProduct)
                          : t("writeoffs.searchBook")}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0" align="start">
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
                          {productOptions.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={String(product.id)}
                              onSelect={() => {
                                setSelectedProduct(product)
                                setProductOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedProduct?.id === product.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {productLabel(product)}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>{t("writeoffs.warehouse")}</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
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

              <div className="space-y-2">
                <Label>{t("writeoffs.quantity")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={availableStock ?? undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                {selectedProduct && warehouseId && (
                  <p className="text-xs text-muted-foreground">
                    {isLoadingStock
                      ? t("common.loading")
                      : availableStock == null
                        ? t("writeoffs.stockUnknown")
                        : t("writeoffs.availableStock", { stock: String(availableStock) })}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={handleSaveClick} disabled={isSaving || isLoadingStock}>
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
