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
import { Textarea } from "@/components/ui/textarea"
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
type WriteoffRow = {
  id: number
  product_title: string | null
  isbn: string | null
  warehouse_name: string | null
  movement_type: WriteoffType
  quantity: number
  reason: string
  occurred_at: string | null
  created_by: string | null
}

function productLabel(p: ProductOption) {
  const title = p.title_en || p.title_ar || p.name || `Product ${p.id}`
  return p.isbn ? `${title} (${p.isbn})` : title
}

export default function StockWriteoffsPage() {
  const { t } = useLanguage()
  const crumbs = useAppCrumbs()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [productOpen, setProductOpen] = useState(false)
  const [productQuery, setProductQuery] = useState("")
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)

  const [warehouseId, setWarehouseId] = useState<string>("")
  const [movementType, setMovementType] = useState<WriteoffType | "">("")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const [rows, setRows] = useState<WriteoffRow[]>([])
  const [isLoadingRows, setIsLoadingRows] = useState(false)

  const productAbortRef = useRef<AbortController | null>(null)

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("accessToken") : ""}`,
    }),
    [],
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
        const res = await fetchWithRetry(`${API_URL}/inventory/warehouses/?page_size=100`, {
          headers,
          signal: controller.signal,
        })
        if (!res.ok) return
        const data = await res.json()
        setWarehouses(Array.isArray(data) ? data : data.results || [])
      } catch {
        /* ignore */
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

  const typeLabel = (type: string) => {
    if (type === "damage") return t("writeoffs.damage")
    if (type === "loss") return t("writeoffs.loss")
    if (type === "reserved") return t("writeoffs.reserved")
    return type
  }

  const handleSave = async () => {
    if (!selectedProduct) {
      toast.error(t("writeoffs.selectBookFirst"))
      return
    }
    if (!warehouseId) {
      toast.error(t("writeoffs.selectWarehouseFirst"))
      return
    }
    if (!movementType) {
      toast.error(t("writeoffs.selectTypeFirst"))
      return
    }
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error(t("writeoffs.invalidQuantity"))
      return
    }
    if (!reason.trim()) {
      toast.error(t("writeoffs.reasonRequired"))
      return
    }

    setIsSaving(true)
    try {
      const res = await fetchWithRetry(`${API_URL}/inventory/stock-writeoffs/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          product_id: selectedProduct.id,
          warehouse_id: Number(warehouseId),
          movement_type: movementType,
          quantity: qty,
          reason: reason.trim(),
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
          qty: String(qty),
          stock: String(data.movement?.current_stock ?? ""),
        }),
      })
      setQuantity("")
      setReason("")
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
                <Label>{t("writeoffs.status")}</Label>
                <Select
                  value={movementType}
                  onValueChange={(v) => setMovementType(v as WriteoffType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("writeoffs.selectStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="damage">{t("writeoffs.damage")}</SelectItem>
                    <SelectItem value="loss">{t("writeoffs.loss")}</SelectItem>
                    <SelectItem value="reserved">{t("writeoffs.reserved")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("writeoffs.quantity")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>{t("writeoffs.reason")}</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("writeoffs.reasonPlaceholder")}
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={() => void handleSave()} disabled={isSaving}>
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
                      <TableHead>{t("writeoffs.status")}</TableHead>
                      <TableHead className="text-right">{t("writeoffs.quantity")}</TableHead>
                      <TableHead>{t("writeoffs.reason")}</TableHead>
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
                        <TableCell>{typeLabel(row.movement_type)}</TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                        <TableCell className="max-w-[280px] truncate">
                          {row.reason || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </ErrorBoundary>
  )
}
