"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { DateRange } from "react-day-picker"
import {
  BookOpen,
  Check,
  ChevronsUpDown,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { DocumentTitle } from "@/components/document-title"
import { PageBreadcrumb, REPORTS_CRUMB, useAppCrumbs } from "@/components/page-breadcrumb"
import { useLanguage } from "@/components/language-context"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fetchWithRetry } from "@/lib/apiClient"
import { API_URL } from "@/lib/config"
import { cn } from "@/lib/utils"
import {
  downloadBookAnalyticsCsv,
  downloadBookAnalyticsExcel,
  downloadBookAnalyticsPdf,
  type BookAnalyticsPayload,
} from "@/lib/exportBookAnalytics"
import { toast } from "sonner"

type Warehouse = { id: number; name_en: string; name_ar: string }
type ProductOption = {
  id: number
  isbn?: string
  title_en?: string
  title_ar?: string
  name?: string
}

function productLabel(p: ProductOption) {
  const title = p.title_en || p.title_ar || p.name || `Product ${p.id}`
  return p.isbn ? `${title} (${p.isbn})` : title
}

function money(n: number | undefined | null, currency = "$") {
  return `${Number(n || 0).toFixed(3)} ${currency}`
}

function currentUsername() {
  try {
    const raw = localStorage.getItem("userData")
    if (!raw) return "unknown"
    const data = JSON.parse(raw) as { username?: string }
    return data.username || "unknown"
  } catch {
    return "unknown"
  }
}

export default function BookSalesAnalyticsPage() {
  const { t } = useLanguage()
  const crumbs = useAppCrumbs()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [productOpen, setProductOpen] = useState(false)
  const [productQuery, setProductQuery] = useState("")
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)

  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [warehouseId, setWarehouseId] = useState<string>("all")
  const [paymentStatus, setPaymentStatus] = useState<string>("all")
  const [invoiceSearch, setInvoiceSearch] = useState("")
  const [discountMin, setDiscountMin] = useState("")
  const [discountMax, setDiscountMax] = useState("")
  const [txPage, setTxPage] = useState(1)

  const [payload, setPayload] = useState<BookAnalyticsPayload | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const productAbortRef = useRef<AbortController | null>(null)
  const analyticsAbortRef = useRef<AbortController | null>(null)

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("accessToken") : ""}`,
    }),
    [],
  )

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
        /* ignore abort */
      }
    })()
    return () => controller.abort()
  }, [headers])

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

  const runReport = useCallback(
    async (page = 1) => {
      if (!selectedProduct) {
        toast.error(t("bookSales.selectBookFirst"))
        return
      }
      analyticsAbortRef.current?.abort()
      analyticsAbortRef.current = new AbortController()
      setIsLoading(true)
      setHasSearched(true)
      setTxPage(page)

      try {
        const params = new URLSearchParams({
          page: String(page),
          page_size: "50",
        })
        if (dateRange?.from && dateRange?.to) {
          params.set("start_date", format(dateRange.from, "yyyy-MM-dd"))
          params.set("end_date", format(dateRange.to, "yyyy-MM-dd"))
        }
        if (warehouseId !== "all") params.set("warehouse_id", warehouseId)
        if (paymentStatus !== "all") params.set("payment_status", paymentStatus)
        if (invoiceSearch.trim()) params.set("invoice_search", invoiceSearch.trim())
        if (discountMin.trim()) params.set("discount_min", discountMin.trim())
        if (discountMax.trim()) params.set("discount_max", discountMax.trim())

        const res = await fetchWithRetry(
          `${API_URL}/sales/products/${selectedProduct.id}/analytics/?${params}`,
          { headers, signal: analyticsAbortRef.current.signal },
        )
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || `Request failed (${res.status})`)
        }
        const data = (await res.json()) as BookAnalyticsPayload
        setPayload(data)
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        setPayload(null)
        toast.error(t("bookSales.loadFailed"), {
          description: error instanceof Error ? error.message : undefined,
        })
      } finally {
        setIsLoading(false)
      }
    },
    [
      selectedProduct,
      dateRange,
      warehouseId,
      paymentStatus,
      invoiceSearch,
      discountMin,
      discountMax,
      headers,
      t,
    ],
  )

  const exportMeta = useMemo(
    () => ({
      generatedBy: currentUsername(),
      generatedAt: new Date().toISOString(),
    }),
    // refresh stamp when exporting via handlers that call currentUsername live
    [payload],
  )

  const handleExport = (kind: "xlsx" | "csv" | "pdf") => {
    if (!payload) return
    const meta = {
      generatedBy: currentUsername(),
      generatedAt: new Date().toISOString(),
    }
    const slug = (payload.product.isbn || String(payload.product.id)).replace(/\s+/g, "-")
    if (kind === "xlsx") {
      downloadBookAnalyticsExcel(payload, meta, `book-sales-${slug}.xlsx`)
    } else if (kind === "csv") {
      downloadBookAnalyticsCsv(payload, meta, `book-sales-${slug}.csv`)
    } else {
      downloadBookAnalyticsPdf(payload, meta, `book-sales-${slug}.pdf`)
    }
    toast.success(t("bookSales.exportDone"))
  }

  const currency = payload?.currency || "$"
  const summary = payload?.summary
  const txCount = payload?.transactions.count || 0
  const txPageSize = payload?.transactions.page_size || 50
  const totalTxPages = Math.max(1, Math.ceil(txCount / txPageSize))

  return (
    <ErrorBoundary>
      <DocumentTitle title={t("bookSales.title")} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb
              items={[
                crumbs.dashboard,
                REPORTS_CRUMB,
                { label: t("bookSales.title") },
              ]}
            />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="rounded-xl bg-muted/50 p-6">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-1 h-6 w-6 text-muted-foreground" />
                <div>
                  <h2 className="text-xl font-semibold">{t("bookSales.title")}</h2>
                  <p className="text-muted-foreground">{t("bookSales.description")}</p>
                </div>
              </div>
              {payload && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      {t("bookSales.export")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("csv")}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("pdf")}>
                      <FileText className="mr-2 h-4 w-4" />
                      PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2 md:col-span-2 xl:col-span-1">
                <Label>{t("bookSales.book")}</Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productOpen}
                      className="w-full justify-between"
                    >
                      <span className="truncate">
                        {selectedProduct
                          ? productLabel(selectedProduct)
                          : t("bookSales.searchBook")}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder={t("bookSales.searchBook")}
                        value={productQuery}
                        onValueChange={setProductQuery}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {isSearchingProducts
                            ? t("common.loading")
                            : t("bookSales.noBook")}
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
                              <div className="min-w-0">
                                <p className="truncate">{productLabel(product)}</p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>{t("bookSales.dateRange")}</Label>
                <DatePickerWithRange
                  date={dateRange ?? { from: undefined, to: undefined }}
                  onDateChange={(range) => setDateRange(range)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("bookSales.warehouse")}</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("common.allWarehouses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.allWarehouses")}</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("bookSales.paymentStatus")}</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("bookSales.all")}</SelectItem>
                    <SelectItem value="paid">{t("bookSales.paid")}</SelectItem>
                    <SelectItem value="partial">{t("bookSales.partial")}</SelectItem>
                    <SelectItem value="unpaid">{t("bookSales.unpaid")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("bookSales.invoiceSearch")}</Label>
                <Input
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  placeholder={t("bookSales.invoiceSearchPlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>{t("bookSales.discountMin")}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={discountMin}
                    onChange={(e) => setDiscountMin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("bookSales.discountMax")}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={discountMax}
                    onChange={(e) => setDiscountMax(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={() => void runReport(1)} disabled={isLoading || !selectedProduct}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("bookSales.runReport")}
              </Button>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          )}

          {!isLoading && hasSearched && !payload && (
            <p className="text-muted-foreground">{t("bookSales.empty")}</p>
          )}

          {payload && summary && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                {[
                  [t("bookSales.metric.invoiced"), summary.copies_invoiced],
                  [t("bookSales.metric.netSold"), summary.copies_net_sold],
                  [t("bookSales.metric.returned"), summary.copies_returned],
                  [t("bookSales.metric.complimentary"), summary.copies_complimentary],
                  [t("bookSales.metric.netRevenue"), money(summary.net_revenue, currency)],
                  [t("bookSales.metric.outstanding"), money(summary.amount_outstanding, currency)],
                ].map(([label, value]) => (
                  <Card key={String(label)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{value}</CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("bookSales.byWarehouse")}</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("bookSales.warehouse")}</TableHead>
                          <TableHead className="text-right">{t("bookSales.metric.invoiced")}</TableHead>
                          <TableHead className="text-right">{t("bookSales.metric.returned")}</TableHead>
                          <TableHead className="text-right">{t("bookSales.stock")}</TableHead>
                          <TableHead className="text-right">{t("bookSales.metric.netRevenue")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payload.by_warehouse.map((row) => (
                          <TableRow key={String(row.warehouse_id ?? row.warehouse_name)}>
                            <TableCell>{String(row.warehouse_name)}</TableCell>
                            <TableCell className="text-right">{Number(row.copies_sold || 0)}</TableCell>
                            <TableCell className="text-right">
                              {Number(row.copies_returned || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(row.current_stock || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              {money(Number(row.net_revenue || 0), currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t("bookSales.discounts")}</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("bookSales.band")}</TableHead>
                          <TableHead className="text-right">{t("bookSales.copies")}</TableHead>
                          <TableHead className="text-right">{t("bookSales.metric.netRevenue")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payload.discounts.map((row) => (
                          <TableRow key={String(row.key)}>
                            <TableCell>{String(row.label)}</TableCell>
                            <TableCell className="text-right">{Number(row.copies || 0)}</TableCell>
                            <TableCell className="text-right">
                              {money(Number(row.net_value || 0), currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{t("bookSales.customers")}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("bookSales.customer")}</TableHead>
                        <TableHead>{t("bookSales.type")}</TableHead>
                        <TableHead className="text-right">{t("bookSales.copies")}</TableHead>
                        <TableHead className="text-right">{t("bookSales.metric.netRevenue")}</TableHead>
                        <TableHead>{t("bookSales.paymentStatus")}</TableHead>
                        <TableHead>{t("bookSales.lastPurchase")}</TableHead>
                        <TableHead>{t("bookSales.repeat")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payload.customers.map((row) => (
                        <TableRow key={String(row.customer_id)}>
                          <TableCell>{String(row.customer_name)}</TableCell>
                          <TableCell>{String(row.customer_type || "—")}</TableCell>
                          <TableCell className="text-right">{Number(row.copies || 0)}</TableCell>
                          <TableCell className="text-right">
                            {money(Number(row.net_value || 0), currency)}
                          </TableCell>
                          <TableCell>{String(row.payment_status)}</TableCell>
                          <TableCell>{String(row.last_purchase_date || "—")}</TableCell>
                          <TableCell>{row.is_repeat ? "Yes" : "No"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{t("bookSales.transactions")}</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {txCount} · {t("bookSales.page")} {txPage}/{totalTxPages}
                  </span>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("bookSales.date")}</TableHead>
                        <TableHead>{t("bookSales.type")}</TableHead>
                        <TableHead>{t("bookSales.invoice")}</TableHead>
                        <TableHead>{t("bookSales.customer")}</TableHead>
                        <TableHead>{t("bookSales.channel")}</TableHead>
                        <TableHead>{t("bookSales.warehouse")}</TableHead>
                        <TableHead className="text-right">{t("bookSales.copies")}</TableHead>
                        <TableHead className="text-right">{t("bookSales.metric.netRevenue")}</TableHead>
                        <TableHead>{t("bookSales.paymentStatus")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payload.transactions.results.map((row, idx) => (
                        <TableRow key={`${row.transaction_type}-${row.id}-${idx}`}>
                          <TableCell>{String(row.date || "—")}</TableCell>
                          <TableCell>{String(row.transaction_type)}</TableCell>
                          <TableCell>
                            {row.invoice_id ? (
                              <Link
                                href={`/invoices?search=${encodeURIComponent(String(row.composite_id || row.invoice_id))}`}
                                className="text-primary underline-offset-4 hover:underline"
                              >
                                {String(row.composite_id || row.invoice_id)}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>{String(row.customer_name || "—")}</TableCell>
                          <TableCell>{String(row.channel || "—")}</TableCell>
                          <TableCell>{String(row.warehouse_name || "—")}</TableCell>
                          <TableCell className="text-right">{Number(row.quantity || 0)}</TableCell>
                          <TableCell className="text-right">
                            {money(Number(row.net_amount || 0), currency)}
                          </TableCell>
                          <TableCell>{String(row.payment_status || "—")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={txPage <= 1 || isLoading}
                      onClick={() => void runReport(txPage - 1)}
                    >
                      {t("common.previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={txPage >= totalTxPages || isLoading}
                      onClick={() => void runReport(txPage + 1)}
                    >
                      {t("common.next")}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground">
                {t("bookSales.rulesNote")} · {exportMeta.generatedAt}
              </p>
            </>
          )}
        </div>
      </SidebarInset>
    </ErrorBoundary>
  )
}
