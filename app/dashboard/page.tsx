"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { AppSidebar } from "../../components/app-sidebar"
import { API_URL } from "@/lib/config"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, CheckCircle2, AlertCircle, Clock, Users, DollarSign, Receipt, TrendingUp, BookOpen } from "lucide-react"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ResponsiveContainer } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"

interface DashboardStats {
  totalProjects: number
  approvedProjects: number
  pendingProjects: number
  totalAuthors: number
  totalTranslators: number
  totalRightsOwners: number
  totalReviewers: number
  approvedPercentage: string
  pendingPercentage: string
  totalBills: number
  totalRevenue: number
  monthlyRevenue: number
  booksSold: number
  billsChangePercent: number
  revenueChangePercent: number
  booksSoldChangePercent: number
}

interface SalesData {
  month: string
  sales: number
  revenue: number
}

interface SalesByCategory {
  category: string
  sales: number
}

interface ProjectStatusData {
  name: string
  value: number
  color: string
}

interface ProjectTrend {
  month: string
  projects: number
}

interface DashboardOverviewResponse {
  filters: {
    warehouse_id: number | null
    start_date: string | null
    end_date: string | null
  }
  projects: {
    total: number
    approved: number
    pending: number
    approved_percentage: number
    pending_percentage: number
  }
  people: {
    authors: number
    translators: number
    rights_owners: number
    reviewers: number
  }
  sales: {
    total_bills: number
    total_revenue: number
    monthly_revenue: number
    books_sold: number
    bills_change_percent: number
    revenue_change_percent: number
    books_sold_change_percent: number
    comparison_mode: "previous_month" | "previous_period"
  }
  project_status: ProjectStatusData[]
  project_trends: ProjectTrend[]
  sales_trend: SalesData[]
  sales_by_genre: SalesByCategory[]
}

interface Warehouse {
  id: number
  name_en: string
  name_ar: string
}

function formatDateParam(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

function dateRangeKey(range: DateRange | null): string {
  if (!range?.from) return ""
  const to = range.to ?? range.from
  return `${formatDateParam(range.from)}|${formatDateParam(to)}`
}

function formatChangePercent(value: number, mode: "previous_month" | "previous_period"): string {
  const sign = value > 0 ? "+" : ""
  const suffix = mode === "previous_period" ? "from previous period" : "from last month"
  return `${sign}${value}% ${suffix}`
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    approvedProjects: 0,
    pendingProjects: 0,
    totalAuthors: 0,
    totalTranslators: 0,
    totalRightsOwners: 0,
    totalReviewers: 0,
    approvedPercentage: '0',
    pendingPercentage: '0',
    totalBills: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    booksSold: 0,
    billsChangePercent: 0,
    revenueChangePercent: 0,
    booksSoldChangePercent: 0,
  })
  const [projectStatusData, setProjectStatusData] = useState<ProjectStatusData[]>([])
  const [projectTrends, setProjectTrends] = useState<ProjectTrend[]>([])
  const [salesTrend, setSalesTrend] = useState<SalesData[]>([])
  const [salesByGenre, setSalesByGenre] = useState<SalesByCategory[]>([])
  const [comparisonMode, setComparisonMode] = useState<"previous_month" | "previous_period">("previous_month")
  const [hasDateFilter, setHasDateFilter] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [appliedWarehouse, setAppliedWarehouse] = useState<string>("all")
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // AbortController refs for request cancellation
  const fetchStatsAbortControllerRef = useRef<AbortController | null>(null)
  const warehousesAbortControllerRef = useRef<AbortController | null>(null)

  // Memoized headers object
  const headers = useMemo(() => {
    const token = localStorage.getItem("accessToken")
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }
  }, [])

  // fetchWithRetry utility with exponential backoff
  const fetchWithRetry = useCallback(async (
    url: string,
    options: RequestInit = {},
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<Response> => {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options)
        
        // For 5xx errors or 429, throw to trigger retry
        if (response.status >= 500 || response.status === 429) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        return response
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Don't retry on AbortError
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error
        }
        
        // Don't retry on 4xx client errors (except 429)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          throw error
        }
        
        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          break
        }
        
        // Wait before retrying (exponential backoff)
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError || new Error('Unknown error in fetchWithRetry')
  }, [])

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
    if (warehousesAbortControllerRef.current) {
      warehousesAbortControllerRef.current.abort()
    }

    const controller = new AbortController()
    warehousesAbortControllerRef.current = controller

    const fetchWarehouses = async () => {
      try {
        const response = await fetchWithRetry(`${API_URL}/inventory/warehouses/`, {
          headers,
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Warehouses API error: ${response.status}`)
        }
        const data = await response.json()
        const list = Array.isArray(data) ? data : data.results || []
        setWarehouses(list)
      } catch (error) {
        handleError(error, "Error fetching warehouses")
      }
    }

    fetchWarehouses()

    return () => {
      if (warehousesAbortControllerRef.current) {
        warehousesAbortControllerRef.current.abort()
      }
    }
  }, [fetchWithRetry, handleError, headers])

  const fetchStats = useCallback(async (
    warehouse: string,
    range: DateRange | null,
  ) => {
    if (fetchStatsAbortControllerRef.current) {
      fetchStatsAbortControllerRef.current.abort()
    }

    const controller = new AbortController()
    fetchStatsAbortControllerRef.current = controller
    setIsLoading(true)

    try {
      const params = new URLSearchParams()
      if (warehouse !== "all") {
        params.set("warehouse_id", warehouse)
      }
      if (range?.from) {
        params.set("start_date", formatDateParam(range.from))
        params.set("end_date", formatDateParam(range.to ?? range.from))
      }

      const query = params.toString()
      const url = query
        ? `${API_URL}/sales/dashboard/?${query}`
        : `${API_URL}/sales/dashboard/`

      const response = await fetchWithRetry(url, {
        headers,
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Dashboard API error: ${response.status}`)
      }

      const data: DashboardOverviewResponse = await response.json()

      setStats({
        totalProjects: data.projects.total,
        approvedProjects: data.projects.approved,
        pendingProjects: data.projects.pending,
        totalAuthors: data.people.authors,
        totalTranslators: data.people.translators,
        totalRightsOwners: data.people.rights_owners,
        totalReviewers: data.people.reviewers,
        approvedPercentage: String(data.projects.approved_percentage),
        pendingPercentage: String(data.projects.pending_percentage),
        totalBills: data.sales.total_bills,
        totalRevenue: data.sales.total_revenue,
        monthlyRevenue: data.sales.monthly_revenue,
        booksSold: data.sales.books_sold,
        billsChangePercent: data.sales.bills_change_percent,
        revenueChangePercent: data.sales.revenue_change_percent,
        booksSoldChangePercent: data.sales.books_sold_change_percent,
      })
      setProjectStatusData(data.project_status)
      setProjectTrends(data.project_trends)
      setSalesTrend(data.sales_trend)
      setSalesByGenre(data.sales_by_genre)
      setComparisonMode(data.sales.comparison_mode)
      setHasDateFilter(Boolean(data.filters.start_date && data.filters.end_date))
    } catch (error) {
      handleError(error, "Error fetching dashboard stats")
      setStats({
        totalProjects: 0,
        approvedProjects: 0,
        pendingProjects: 0,
        totalAuthors: 0,
        totalTranslators: 0,
        totalRightsOwners: 0,
        totalReviewers: 0,
        approvedPercentage: '0',
        pendingPercentage: '0',
        totalBills: 0,
        totalRevenue: 0,
        monthlyRevenue: 0,
        booksSold: 0,
        billsChangePercent: 0,
        revenueChangePercent: 0,
        booksSoldChangePercent: 0,
      })
      setProjectStatusData([])
      setProjectTrends([])
      setSalesTrend([])
      setSalesByGenre([])
      setComparisonMode("previous_month")
      setHasDateFilter(false)
    } finally {
      setIsLoading(false)
    }
  }, [fetchWithRetry, handleError, headers])

  useEffect(() => {
    fetchStats(appliedWarehouse, appliedDateRange)

    // Cleanup: abort pending requests on unmount
    return () => {
      if (fetchStatsAbortControllerRef.current) {
        fetchStatsAbortControllerRef.current.abort()
      }
    }
  }, [fetchStats, appliedWarehouse, appliedDateRange])

  const handleApplyFilters = () => {
    setAppliedWarehouse(selectedWarehouse)
    setAppliedDateRange(dateRange)
  }

  const handleClearFilters = () => {
    setSelectedWarehouse("all")
    setDateRange(null)
    setAppliedWarehouse("all")
    setAppliedDateRange(null)
  }

  const hasPendingFilterChanges =
    selectedWarehouse !== appliedWarehouse ||
    dateRangeKey(dateRange) !== dateRangeKey(appliedDateRange)

  const hasActiveFilters = appliedWarehouse !== "all" || Boolean(appliedDateRange?.from)

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
                  <BreadcrumbPage>Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Dashboard</h2>
                <p className="text-muted-foreground">Welcome to your project management dashboard.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All warehouses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All warehouses</SelectItem>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                        {warehouse.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DatePickerWithRange
                  date={dateRange ?? { from: undefined, to: undefined }}
                  onDateChange={(range) => setDateRange(range ?? null)}
                />
                <Button onClick={handleApplyFilters} disabled={isLoading}>
                  {isLoading ? "Loading..." : "Apply Filters"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  disabled={isLoading || (!hasActiveFilters && !hasPendingFilterChanges)}
                >
                  Clear
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="py-8 text-center">Loading dashboard data...</div>
            ) : (
              <>
                {/* Projects Overview - Consolidated Box */}
                <div className="mb-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Projects Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600">{stats.totalProjects}</div>
                          <p className="text-sm text-muted-foreground">Total Projects</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {stats.approvedProjects} approved, {stats.pendingProjects} pending
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-600">{stats.approvedProjects}</div>
                          <p className="text-sm text-muted-foreground">Approved Projects</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {stats.approvedPercentage}% of total projects
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-yellow-600">{stats.pendingProjects}</div>
                          <p className="text-sm text-muted-foreground">Pending Projects</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {stats.pendingPercentage}% of total projects
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sales Statistics */}
                <div className={`grid gap-4 md:grid-cols-2 ${hasDateFilter ? "lg:grid-cols-3" : "lg:grid-cols-4"} mb-8`}>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {hasDateFilter ? "Bills in Period" : "Total Bills"}
                      </CardTitle>
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalBills}</div>
                      <p className="text-xs text-muted-foreground">
                        {formatChangePercent(stats.billsChangePercent, comparisonMode)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {hasDateFilter ? "Period Revenue" : "Total Revenue"}
                      </CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalRevenue.toLocaleString()} OMR</div>
                      <p className="text-xs text-muted-foreground">
                        {formatChangePercent(stats.revenueChangePercent, comparisonMode)}
                      </p>
                    </CardContent>
                  </Card>

                  {!hasDateFilter && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.monthlyRevenue.toLocaleString()} OMR</div>
                      <p className="text-xs text-muted-foreground">
                        Current month
                      </p>
                    </CardContent>
                  </Card>
                  )}

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {hasDateFilter ? "Books Sold in Period" : "Books Sold"}
                      </CardTitle>
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.booksSold}</div>
                      <p className="text-xs text-muted-foreground">
                        {formatChangePercent(stats.booksSoldChangePercent, comparisonMode)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* People Statistics */}
                <div className="mb-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        People Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">{stats.totalAuthors}</div>
                          <p className="text-sm text-muted-foreground">Authors</p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-indigo-600">{stats.totalTranslators}</div>
                          <p className="text-sm text-muted-foreground">Translators</p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-pink-600">{stats.totalRightsOwners}</div>
                          <p className="text-sm text-muted-foreground">Rights Owners</p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">{stats.totalReviewers}</div>
                          <p className="text-sm text-muted-foreground">Reviewers</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Section - Each chart on one row */}
                <div className="space-y-6">
                  {/* Project Status Pie Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Project Status Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={projectStatusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={120}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {projectStatusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Project Trends Line Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Project Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={projectTrends}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="projects" stroke="#8884d8" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sales & Revenue Trend Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Sales & Revenue Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={salesTrend}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <Tooltip />
                            <Legend />
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="sales"
                              stroke="#8884d8"
                              strokeWidth={2}
                              name="Sales"
                            />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="revenue"
                              stroke="#82ca9d"
                              strokeWidth={2}
                              name="Revenue (OMR)"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sales by Genre Chart - Full Width */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Sales by Genre</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={salesByGenre}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="sales" fill="#8884d8" name="Sales" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

