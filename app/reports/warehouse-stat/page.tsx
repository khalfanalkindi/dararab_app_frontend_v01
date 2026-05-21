"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { AppSidebar } from "../../../components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, BookOpen, TrendingUp, Percent, Download, FileSpreadsheet, FileText } from "lucide-react"
import { format } from "date-fns"
import jsPDF from "jspdf"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ResponsiveContainer } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
import { API_URL } from "@/lib/config"
import { toast } from "@/hooks/use-toast"

interface WarehouseStats {
  totalIncome: number
  totalIncomeWithoutDiscount: number
  totalBooksSold: number
  billsWithDiscount: number
  totalBills: number
  averageDiscount: number
  popularBooks: Array<{ title: string, quantity: number }>
  topCategories: Array<{ category: string, quantity: number }>
  dailySales: Array<{ date: string, sales: number, revenue: number }>
  paidBooks: Array<{ title: string, quantity: number, totalPaid: number }>
}

interface Warehouse {
  id: number
  name_en: string
  name_ar: string
}

interface ExportMeta {
  warehouseName: string
  startDate: string
  endDate: string
}

function formatDateParam(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export default function WarehouseStats() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [stats, setStats] = useState<WarehouseStats | null>(null)
  const [exportMeta, setExportMeta] = useState<ExportMeta | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

  // AbortController refs for request cancellation
  const warehousesAbortControllerRef = useRef<AbortController | null>(null)
  const statsAbortControllerRef = useRef<AbortController | null>(null)

  // Memoized headers to avoid recreating on every render
  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }), [])

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

  // Retry utility function with exponential backoff
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
            }, { once: true })
          }
        })
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Request failed after retries')
  }, [])

  // Fetch warehouses on mount
  const fetchWarehouses = useCallback(async () => {
    // Cancel previous request if still pending
    if (warehousesAbortControllerRef.current) {
      warehousesAbortControllerRef.current.abort()
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController()
    warehousesAbortControllerRef.current = abortController
    
    try {
      const res = await fetchWithRetry(`${API_URL}/inventory/warehouses/`, { 
        headers,
        signal: abortController.signal
      })
      
      if (!res.ok) {
        throw new Error(`Failed to fetch warehouses: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      setWarehouses(Array.isArray(data) ? data : data.results || [])
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      handleError(error, "Failed to fetch warehouses")
      setWarehouses([])
      toast({
        title: "Error",
        description: "Failed to load warehouses. Please try again.",
        variant: "destructive",
      })
    }
  }, [headers, fetchWithRetry, handleError])

  useEffect(() => {
    fetchWarehouses()
    
    // Cleanup: abort request when component unmounts
    return () => {
      if (warehousesAbortControllerRef.current) {
        warehousesAbortControllerRef.current.abort()
      }
    }
  }, [fetchWarehouses])

  const exportToCsv = useCallback(() => {
    if (!stats || !exportMeta) return

    const periodLabel =
      exportMeta.startDate === exportMeta.endDate
        ? exportMeta.startDate
        : `${exportMeta.startDate} to ${exportMeta.endDate}`

    const escape = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`

    const rows: (string | number)[][] = [
      ["Warehouse Statistics Report"],
      ["Warehouse", exportMeta.warehouseName],
      ["Period", periodLabel],
      [],
      ["Metric", "Value"],
      ["Total Income (with Discount) ($)", stats.totalIncome],
      ["Total Income Without Discount ($)", stats.totalIncomeWithoutDiscount],
      ["Total Books Sold", stats.totalBooksSold],
      ["Total Bills", stats.totalBills],
      ["Bills with Discount", stats.billsWithDiscount],
      ["Average Discount (%)", stats.averageDiscount],
      [],
      ["Popular Books", "Quantity Sold"],
      ...stats.popularBooks.map((b) => [b.title, b.quantity]),
      [],
      ["Top Categories", "Quantity Sold"],
      ...stats.topCategories.map((c) => [c.category, c.quantity]),
      [],
      ["Daily Sales", "Units", "Revenue ($)"],
      ...stats.dailySales.map((d) => [d.date, d.sales, d.revenue]),
    ]

    const csv = rows.map((row) => row.map(escape).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `warehouse-stats-${exportMeta.startDate}${exportMeta.endDate !== exportMeta.startDate ? `_to_${exportMeta.endDate}` : ""}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [stats, exportMeta])

  const exportToPdf = useCallback(() => {
    if (!stats || !exportMeta) return

    const periodLabel =
      exportMeta.startDate === exportMeta.endDate
        ? exportMeta.startDate
        : `${exportMeta.startDate} to ${exportMeta.endDate}`

    const doc = new jsPDF()
    let y = 14
    const line = (text: string, size = 10) => {
      doc.setFontSize(size)
      const lines = doc.splitTextToSize(text, 180)
      doc.text(lines, 14, y)
      y += lines.length * (size * 0.45) + 2
    }

    line("Warehouse Statistics Report", 14)
    line(`Warehouse: ${exportMeta.warehouseName}`)
    line(`Period: ${periodLabel}`)
    y += 4
    line("Summary", 12)
    line(`Total Income (with Discount): $${stats.totalIncome.toLocaleString()}`)
    line(`Total Income Without Discount: $${stats.totalIncomeWithoutDiscount.toLocaleString()}`)
    line(`Total Books Sold: ${stats.totalBooksSold.toLocaleString()}`)
    line(`Total Bills: ${stats.totalBills}`)
    line(`Bills with Discount: ${stats.billsWithDiscount}`)
    line(`Average Discount: ${stats.averageDiscount}%`)

    if (stats.popularBooks.length > 0) {
      y += 4
      line("Popular Books", 12)
      stats.popularBooks.forEach((b) => line(`  ${b.title}: ${b.quantity}`))
    }

    if (stats.topCategories.length > 0) {
      y += 4
      line("Top Categories", 12)
      stats.topCategories.forEach((c) => line(`  ${c.category}: ${c.quantity}`))
    }

    if (stats.dailySales.length > 0) {
      y += 4
      line("Daily Sales", 12)
      stats.dailySales.forEach((d) =>
        line(`  ${d.date}: ${d.sales} units, $${Number(d.revenue).toLocaleString()}`)
      )
    }

    doc.save(
      `warehouse-stats-${exportMeta.startDate}${exportMeta.endDate !== exportMeta.startDate ? `_to_${exportMeta.endDate}` : ""}.pdf`
    )
  }, [stats, exportMeta])

  const paidBooksTotals = useMemo(() => {
    if (!stats?.paidBooks.length) return { quantity: 0, totalPaid: 0 }
    return stats.paidBooks.reduce(
      (acc, row) => ({
        quantity: acc.quantity + row.quantity,
        totalPaid: acc.totalPaid + row.totalPaid,
      }),
      { quantity: 0, totalPaid: 0 }
    )
  }, [stats?.paidBooks])

  const downloadFile = useCallback((filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }, [])

  const exportPaidBooksCsv = useCallback(() => {
    if (!stats?.paidBooks.length || !exportMeta) return

    const periodLabel =
      exportMeta.startDate === exportMeta.endDate
        ? exportMeta.startDate
        : `${exportMeta.startDate} to ${exportMeta.endDate}`

    const escape = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`

    const rows: (string | number)[][] = [
      ["Paid Books Report"],
      ["Warehouse", exportMeta.warehouseName],
      ["Period", periodLabel],
      [],
      ["Book Title", "Quantity", "Total Paid ($)"],
      ...stats.paidBooks.map((b) => [b.title, b.quantity, b.totalPaid]),
      [],
      ["Total", paidBooksTotals.quantity, paidBooksTotals.totalPaid],
    ]

    const csv = rows.map((row) => row.map(escape).join(",")).join("\n")
    const suffix =
      exportMeta.endDate !== exportMeta.startDate
        ? `_to_${exportMeta.endDate}`
        : ""
    downloadFile(`warehouse-paid-books-${exportMeta.startDate}${suffix}.csv`, "\uFEFF" + csv, "text/csv;charset=utf-8;")
  }, [stats, exportMeta, paidBooksTotals, downloadFile])

  const exportPaidBooksPdf = useCallback(() => {
    if (!stats?.paidBooks.length || !exportMeta) return

    const periodLabel =
      exportMeta.startDate === exportMeta.endDate
        ? exportMeta.startDate
        : `${exportMeta.startDate} to ${exportMeta.endDate}`

    const doc = new jsPDF()
    let y = 14
    const line = (text: string, size = 10) => {
      doc.setFontSize(size)
      const lines = doc.splitTextToSize(text, 180)
      doc.text(lines, 14, y)
      y += lines.length * (size * 0.45) + 2
      if (y > 270) {
        doc.addPage()
        y = 14
      }
    }

    line("Paid Books Report", 14)
    line(`Warehouse: ${exportMeta.warehouseName}`)
    line(`Period: ${periodLabel}`)
    y += 4
    line("Book Title | Qty | Total Paid ($)", 11)
    stats.paidBooks.forEach((b) => {
      line(`${b.title} | ${b.quantity} | $${Number(b.totalPaid).toLocaleString()}`)
    })
    y += 2
    line(
      `Total: ${paidBooksTotals.quantity} units, $${paidBooksTotals.totalPaid.toLocaleString()}`
    )

    const suffix =
      exportMeta.endDate !== exportMeta.startDate
        ? `_to_${exportMeta.endDate}`
        : ""
    doc.save(`warehouse-paid-books-${exportMeta.startDate}${suffix}.pdf`)
  }, [stats, exportMeta, paidBooksTotals])

  // Fetch stats only after user clicks button
  const fetchStats = useCallback(async () => {
    if (!selectedWarehouse || !dateRange?.from) return

    const endDate = dateRange.to ?? dateRange.from
    const startDateStr = formatDateParam(dateRange.from)
    const endDateStr = formatDateParam(endDate)

    // Cancel previous request if still pending
    if (statsAbortControllerRef.current) {
      statsAbortControllerRef.current.abort()
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController()
    statsAbortControllerRef.current = abortController
    
    setIsLoading(true)
    setHasSearched(true)
    setExportMeta(null)
    try {
      const params = new URLSearchParams({
        warehouse_id: selectedWarehouse,
        start_date: startDateStr,
        end_date: endDateStr,
      })
      
      const res = await fetchWithRetry(`${API_URL}/sales/warehouse-dashboard/?${params}`, { 
        headers,
        signal: abortController.signal
      })
      
      if (!res.ok) {
        throw new Error(`Failed to fetch warehouse statistics: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      const warehouseName =
        warehouses.find((w) => w.id.toString() === selectedWarehouse)?.name_en ??
        selectedWarehouse

      setStats({
        totalIncome: data.total_income,
        totalIncomeWithoutDiscount: data.total_income_without_discount,
        totalBooksSold: data.total_books_sold,
        billsWithDiscount: data.bills_with_discount,
        totalBills: data.total_bills,
        averageDiscount: data.average_discount,
        popularBooks: data.popular_books.map((b: { product__title_ar: string; total: number }) => ({
          title: b.product__title_ar,
          quantity: b.total,
        })),
        topCategories: data.top_categories.map((c: { product__genre__display_name_en: string; total: number }) => ({
          category: c.product__genre__display_name_en,
          quantity: c.total,
        })),
        dailySales: data.daily_sales,
        paidBooks: (data.paid_books ?? []).map(
          (b: { product__title_ar: string; quantity: number; total_paid: number }) => ({
            title: b.product__title_ar ?? "Unknown",
            quantity: b.quantity ?? 0,
            totalPaid: Number(b.total_paid ?? 0),
          })
        ),
      })
      setExportMeta({
        warehouseName,
        startDate: startDateStr,
        endDate: endDateStr,
      })
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      handleError(error, "Failed to fetch warehouse statistics")
      setStats(null)
      setExportMeta(null)
      toast({
        title: "Error",
        description: "Failed to load warehouse statistics. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedWarehouse, dateRange, warehouses, headers, fetchWithRetry, handleError])

  // Cleanup: Cancel all pending requests on component unmount
  useEffect(() => {
    return () => {
      if (warehousesAbortControllerRef.current) {
        warehousesAbortControllerRef.current.abort()
      }
      if (statsAbortControllerRef.current) {
        statsAbortControllerRef.current.abort()
      }
    }
  }, [])

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
                <BreadcrumbItem>
                  <BreadcrumbPage>Warehouse Statistics</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Warehouse Statistics</h2>
              <div className="flex gap-4">
                <Select value={selectedWarehouse ?? ""} onValueChange={v => setSelectedWarehouse(v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                        {warehouse.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DatePickerWithRange date={dateRange ?? {from: undefined, to: undefined}} onDateChange={range => setDateRange(range ?? null)} />
                <Button
                  onClick={fetchStats}
                  disabled={!selectedWarehouse || !dateRange?.from || isLoading}
                >
                  {isLoading ? 'Loading...' : 'Show Statistics'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={!stats || isLoading}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportToCsv}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Download Excel (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToPdf}>
                      <FileText className="mr-2 h-4 w-4" />
                      Download PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {/* Only show stats if user has searched and stats are available */}
            {hasSearched && stats && !isLoading && (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                  {/* Total Income (with Discount) */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Income (with Discount)</CardTitle>
                      <DollarSign className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.totalIncome?.toLocaleString() ?? 0} $</div>
                      <p className="text-xs text-muted-foreground">
                        {stats && stats.totalIncomeWithoutDiscount > 0 ? ((stats.totalIncome / stats.totalIncomeWithoutDiscount) * 100).toFixed(1) : 0}% of original
                      </p>
                    </CardContent>
                  </Card>
                  {/* Total Income Without Discount */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Income Without Discount</CardTitle>
                      <DollarSign className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.totalIncomeWithoutDiscount?.toLocaleString() ?? 0} $</div>
                    </CardContent>
                  </Card>
                  {/* Total Books Sold */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Books Sold</CardTitle>
                      <BookOpen className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.totalBooksSold?.toLocaleString() ?? 0}</div>
                      <p className="text-xs text-muted-foreground">
                        Across {stats?.totalBills ?? 0} bills
                      </p>
                    </CardContent>
                  </Card>
                  {/* Bills with Discount */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Bills with Discount</CardTitle>
                      <Percent className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.billsWithDiscount ?? 0}</div>
                      <p className="text-xs text-muted-foreground">
                        {stats && stats.totalBills > 0 ? ((stats.billsWithDiscount / stats.totalBills) * 100).toFixed(1) : 0}% of total bills
                      </p>
                    </CardContent>
                  </Card>
                  {/* Average Discount */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Average Discount</CardTitle>
                      <TrendingUp className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.averageDiscount ?? 0}%</div>
                      <p className="text-xs text-muted-foreground">
                        Average discount per bill
                      </p>
                    </CardContent>
                  </Card>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Popular Books */}
                  <Card className="col-span-1">
                    <CardHeader>
                      <CardTitle>Popular Books</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={stats?.popularBooks ?? []}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="title" angle={-45} textAnchor="end" height={100} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="quantity" fill="#8884d8" name="Quantity Sold" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  {/* Top Selling Categories */}
                  <Card className="col-span-1">
                    <CardHeader>
                      <CardTitle>Top Selling Categories</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats?.topCategories ?? []}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={150}
                              fill="#8884d8"
                              dataKey="quantity"
                              nameKey="category"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                              {(stats?.topCategories ?? []).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  {/* Daily Sales Trend */}
                  <Card className="col-span-2">
                    <CardHeader>
                      <CardTitle>Daily Sales Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={stats?.dailySales ?? []}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <Tooltip />
                            <Legend />
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="sales"
                              stroke="#8884d8"
                              name="Number of Sales"
                            />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="revenue"
                              stroke="#82ca9d"
                              name="Revenue ($)"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="mt-8">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle>Paid Books</CardTitle>
                      <CardDescription>
                        Books with payment in this period (per title: quantity and total paid amount)
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!stats.paidBooks.length}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Export Paid Books
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={exportPaidBooksCsv}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          Download Excel (CSV)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportPaidBooksPdf}>
                          <FileText className="mr-2 h-4 w-4" />
                          Download PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent>
                    {stats.paidBooks.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50%]">Book Title</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Total Paid ($)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats.paidBooks.map((book, index) => (
                            <TableRow key={`${book.title}-${index}`}>
                              <TableCell className="font-medium">{book.title}</TableCell>
                              <TableCell className="text-right">{book.quantity.toLocaleString()}</TableCell>
                              <TableCell className="text-right">
                                {book.totalPaid.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 3,
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell className="font-semibold">Total</TableCell>
                            <TableCell className="text-right font-semibold">
                              {paidBooksTotals.quantity.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {paidBooksTotals.totalPaid.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 3,
                              })}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No paid books in this period.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
            {/* Show nothing if not searched yet */}
            {!hasSearched && (
              <div className="text-center text-muted-foreground py-12">Please select a warehouse and a date (or range), then click &quot;Show Statistics&quot;.</div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

