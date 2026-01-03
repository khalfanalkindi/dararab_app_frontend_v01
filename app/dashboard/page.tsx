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
}

// Add mock sales data interface
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
    booksSold: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  // AbortController refs for request cancellation
  const fetchStatsAbortControllerRef = useRef<AbortController | null>(null)

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

  // Mock sales data
  const salesData: SalesData[] = [
    { month: 'Jan', sales: 45, revenue: 4500 },
    { month: 'Feb', sales: 52, revenue: 5200 },
    { month: 'Mar', sales: 48, revenue: 4800 },
    { month: 'Apr', sales: 60, revenue: 6000 },
  ]

  // Mock sales data by genre
  const salesByCategory: SalesByCategory[] = [
    { category: 'Fiction', sales: 45 },
    { category: 'Non-Fiction', sales: 35 },
    { category: 'Biography', sales: 25 },
    { category: 'History', sales: 30 },
    { category: 'Science', sales: 20 },
    { category: 'Poetry', sales: 15 },
    { category: 'Children', sales: 40 },
    { category: 'Religion', sales: 25 },
  ]

  // Project status data for pie chart
  const projectStatusData: ProjectStatusData[] = [
    { name: 'Approved', value: 0, color: '#10b981' },
    { name: 'Pending', value: 0, color: '#f59e0b' },
  ]

  // Update project status data when stats change
  const updatedProjectStatusData = [
    { name: 'Approved', value: stats.approvedProjects, color: '#10b981' },
    { name: 'Pending', value: stats.pendingProjects, color: '#f59e0b' },
  ]

  useEffect(() => {
    // Log the access token for debugging (kept for testing purposes)
    const accessToken = localStorage.getItem("accessToken")
    console.log("Access Token:", accessToken)
    
    // Cancel previous request if any
    if (fetchStatsAbortControllerRef.current) {
      fetchStatsAbortControllerRef.current.abort()
    }
    
    const controller = new AbortController()
    fetchStatsAbortControllerRef.current = controller
    
    const fetchStats = async () => {
      try {
        // Fetch all data in parallel
        const [projectsRes, authorsRes, translatorsRes, rightsOwnersRes, reviewersRes] = await Promise.allSettled([
          fetchWithRetry(`${API_URL}/inventory/projects/`, {
            headers,
            signal: controller.signal,
          }),
          fetchWithRetry(`${API_URL}/inventory/authors/`, {
            headers,
            signal: controller.signal,
          }),
          fetchWithRetry(`${API_URL}/inventory/translators/`, {
            headers,
            signal: controller.signal,
          }),
          fetchWithRetry(`${API_URL}/inventory/rights-owners/`, {
            headers,
            signal: controller.signal,
          }),
          fetchWithRetry(`${API_URL}/inventory/reviewers/`, {
            headers,
            signal: controller.signal,
          }),
        ])

        // Process projects
        let projects: any[] = []
        if (projectsRes.status === 'fulfilled' && projectsRes.value.ok) {
          const projectsData = await projectsRes.value.json()
          projects = Array.isArray(projectsData) ? projectsData : projectsData.results || []
        } else if (projectsRes.status === 'rejected') {
          throw new Error(`Projects API error: ${projectsRes.reason}`)
        } else if (projectsRes.status === 'fulfilled' && !projectsRes.value.ok) {
          throw new Error(`Projects API error: ${projectsRes.value.status}`)
        }

        // Process authors
        let authors: any[] = []
        if (authorsRes.status === 'fulfilled' && authorsRes.value.ok) {
          const authorsData = await authorsRes.value.json()
          authors = Array.isArray(authorsData) ? authorsData : authorsData.results || []
        } else if (authorsRes.status === 'rejected') {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Authors API error:', authorsRes.reason)
          }
        } else if (authorsRes.status === 'fulfilled' && !authorsRes.value.ok) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`Authors API error: ${authorsRes.value.status}`)
          }
        }

        // Process translators
        let translators: any[] = []
        if (translatorsRes.status === 'fulfilled' && translatorsRes.value.ok) {
          const translatorsData = await translatorsRes.value.json()
          translators = Array.isArray(translatorsData) ? translatorsData : translatorsData.results || []
        } else if (translatorsRes.status === 'rejected') {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Translators API error:', translatorsRes.reason)
          }
        } else if (translatorsRes.status === 'fulfilled' && !translatorsRes.value.ok) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`Translators API error: ${translatorsRes.value.status}`)
          }
        }

        // Process rights owners
        let rightsOwners: any[] = []
        if (rightsOwnersRes.status === 'fulfilled' && rightsOwnersRes.value.ok) {
          const rightsOwnersData = await rightsOwnersRes.value.json()
          rightsOwners = Array.isArray(rightsOwnersData) ? rightsOwnersData : rightsOwnersData.results || []
        } else if (rightsOwnersRes.status === 'rejected') {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Rights Owners API error:', rightsOwnersRes.reason)
          }
        } else if (rightsOwnersRes.status === 'fulfilled' && !rightsOwnersRes.value.ok) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`Rights Owners API error: ${rightsOwnersRes.value.status}`)
          }
        }

        // Process reviewers
        let reviewers: any[] = []
        if (reviewersRes.status === 'fulfilled' && reviewersRes.value.ok) {
          const reviewersData = await reviewersRes.value.json()
          reviewers = Array.isArray(reviewersData) ? reviewersData : reviewersData.results || []
        } else if (reviewersRes.status === 'rejected') {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Reviewers API error:', reviewersRes.reason)
          }
        } else if (reviewersRes.status === 'fulfilled' && !reviewersRes.value.ok) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`Reviewers API error: ${reviewersRes.value.status}`)
          }
        }

        const approvedProjects = projects.filter((p: any) => p.approval_status === true).length

        // Calculate percentages safely
        const totalProjects = projects.length
        const approvedPercentage = totalProjects > 0 ? ((approvedProjects / totalProjects) * 100).toFixed(1) : '0'
        const pendingPercentage = totalProjects > 0 ? (((totalProjects - approvedProjects) / totalProjects) * 100).toFixed(1) : '0'

        setStats({
          totalProjects,
          approvedProjects,
          pendingProjects: totalProjects - approvedProjects,
          totalAuthors: authors.length,
          totalTranslators: translators.length,
          totalRightsOwners: rightsOwners.length,
          totalReviewers: reviewers.length,
          approvedPercentage,
          pendingPercentage,
          totalBills: 156, // Mock data
          totalRevenue: 24500, // Mock data
          monthlyRevenue: 6000, // Mock data
          booksSold: 180 // Mock data
        })

        // Log the data for debugging (only in development)
        if (process.env.NODE_ENV !== 'production') {
          console.log('Projects:', projects)
          console.log('Authors:', authors)
          console.log('Translators:', translators)
          console.log('Rights Owners:', rightsOwners)
          console.log('Reviewers:', reviewers)
        }
      } catch (error) {
        handleError(error, "Error fetching dashboard stats")
        // Set default values in case of error
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
          booksSold: 0
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()

    // Cleanup: abort pending requests on unmount
    return () => {
      if (fetchStatsAbortControllerRef.current) {
        fetchStatsAbortControllerRef.current.abort()
      }
    }
  }, [fetchWithRetry, handleError, headers])

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
            <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
            <p className="mb-6">Welcome to your project management dashboard.</p>

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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalBills}</div>
                      <p className="text-xs text-muted-foreground">
                        +12% from last month
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalRevenue.toLocaleString()} OMR</div>
                      <p className="text-xs text-muted-foreground">
                        +8% from last month
                      </p>
                    </CardContent>
                  </Card>

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

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Books Sold</CardTitle>
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.booksSold}</div>
                      <p className="text-xs text-muted-foreground">
                        +15% from last month
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
                              data={updatedProjectStatusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={120}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {updatedProjectStatusData.map((entry, index) => (
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
                            data={[
                              { month: 'Jan', projects: 5 },
                              { month: 'Feb', projects: 8 },
                              { month: 'Mar', projects: 12 },
                              { month: 'Apr', projects: stats.totalProjects },
                            ]}
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
                            data={salesData}
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
                            data={salesByCategory}
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

