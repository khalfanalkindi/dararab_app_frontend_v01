"use client"

import { useState, useEffect } from "react"
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
import { FileText, DollarSign, BookOpen, TrendingUp, Percent, Receipt, BarChart3 } from "lucide-react"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ResponsiveContainer } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { addDays } from "date-fns"
import { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

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
}

interface Warehouse {
  id: number
  name_en: string
  name_ar: string
}

export default function WarehouseStats() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [stats, setStats] = useState<WarehouseStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

  // Fetch warehouses on mount
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
        const res = await fetch(`${API_URL}/inventory/warehouses/`, { headers })
        const data = await res.json()
        setWarehouses(Array.isArray(data) ? data : data.results || [])
      } catch (e) {
        setWarehouses([])
      }
    }
    fetchWarehouses()
  }, [])

  // Fetch stats only after user clicks button
  const fetchStats = async () => {
    if (!selectedWarehouse || !dateRange?.from || !dateRange?.to) return
    setIsLoading(true)
    setHasSearched(true)
    try {
      const params = new URLSearchParams({ warehouse_id: selectedWarehouse })
      if (dateRange.from) params.set('start_date', dateRange.from.toISOString().slice(0, 10))
      if (dateRange.to) params.set('end_date', dateRange.to.toISOString().slice(0, 10))
      const token = localStorage.getItem("accessToken");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      const res = await fetch(`${API_URL}/sales/warehouse-dashboard/?${params}`, { headers })
      const data = await res.json()
      setStats({
        totalIncome: data.total_income,
        totalIncomeWithoutDiscount: data.total_income_without_discount,
        totalBooksSold: data.total_books_sold,
        billsWithDiscount: data.bills_with_discount,
        totalBills: data.total_bills,
        averageDiscount: data.average_discount,
        popularBooks: data.popular_books.map((b: any) => ({
          title: b.product__title_ar,
          quantity: b.total,
        })),
        topCategories: data.top_categories.map((c: any) => ({
          category: c.product__genre__display_name_en,
          quantity: c.total,
        })),
        dailySales: data.daily_sales,
      })
    } catch (e) {
      setStats(null)
    } finally {
      setIsLoading(false)
    }
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
                  disabled={!selectedWarehouse || !dateRange?.from || !dateRange?.to || isLoading}
                >
                  {isLoading ? 'Loading...' : 'Show Statistics'}
                </Button>
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
                      <div className="text-2xl font-bold">{stats?.totalIncome?.toLocaleString() ?? 0} OMR</div>
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
                      <div className="text-2xl font-bold">{stats?.totalIncomeWithoutDiscount?.toLocaleString() ?? 0} OMR</div>
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
              </>
            )}
            {/* Show nothing if not searched yet */}
            {!hasSearched && (
              <div className="text-center text-muted-foreground py-12">Please select a warehouse and date range, then click "Show Statistics".</div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

