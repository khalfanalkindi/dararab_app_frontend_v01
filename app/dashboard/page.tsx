"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "../../components/app-sidebar"
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
import { FileText, CheckCircle2, AlertCircle, Clock, Users } from "lucide-react"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from "recharts"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

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
    pendingPercentage: '0'
  })
  const [isLoading, setIsLoading] = useState(true)

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

  useEffect(() => {
    // Log the access token for debugging
    const accessToken = localStorage.getItem("accessToken")
    console.log("Access Token:", accessToken)
    
    const fetchStats = async () => {
      try {
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        }

        // Fetch projects
        const projectsRes = await fetch(`${API_URL}/inventory/projects/`, { headers })
        if (!projectsRes.ok) {
          throw new Error(`Projects API error: ${projectsRes.status}`)
        }
        const projectsData = await projectsRes.json()
        // Handle both array and object responses
        const projects = Array.isArray(projectsData) ? projectsData : projectsData.results || []
        const approvedProjects = projects.filter((p: any) => p.approval_status === true).length

        // Fetch authors
        const authorsRes = await fetch(`${API_URL}/inventory/authors/`, { headers })
        if (!authorsRes.ok) {
          throw new Error(`Authors API error: ${authorsRes.status}`)
        }
        const authorsData = await authorsRes.json()
        const authors = Array.isArray(authorsData) ? authorsData : authorsData.results || []

        // Fetch translators
        const translatorsRes = await fetch(`${API_URL}/inventory/translators/`, { headers })
        if (!translatorsRes.ok) {
          throw new Error(`Translators API error: ${translatorsRes.status}`)
        }
        const translatorsData = await translatorsRes.json()
        const translators = Array.isArray(translatorsData) ? translatorsData : translatorsData.results || []

        // Fetch rights owners
        const rightsOwnersRes = await fetch(`${API_URL}/inventory/rights-owners/`, { headers })
        if (!rightsOwnersRes.ok) {
          throw new Error(`Rights Owners API error: ${rightsOwnersRes.status}`)
        }
        const rightsOwnersData = await rightsOwnersRes.json()
        const rightsOwners = Array.isArray(rightsOwnersData) ? rightsOwnersData : rightsOwnersData.results || []

        // Fetch reviewers
        const reviewersRes = await fetch(`${API_URL}/inventory/reviewers/`, { headers })
        if (!reviewersRes.ok) {
          throw new Error(`Reviewers API error: ${reviewersRes.status}`)
        }
        const reviewersData = await reviewersRes.json()
        const reviewers = Array.isArray(reviewersData) ? reviewersData : reviewersData.results || []

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
          pendingPercentage
        })

        // Log the data for debugging
        console.log('Projects:', projects)
        console.log('Authors:', authors)
        console.log('Translators:', translators)
        console.log('Rights Owners:', rightsOwners)
        console.log('Reviewers:', reviewers)
      } catch (error) {
        console.error("Error fetching dashboard stats:", error)
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
          pendingPercentage: '0'
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                  {/* Projects Stats */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalProjects}</div>
                      <p className="text-xs text-muted-foreground">
                        {stats.approvedProjects} approved, {stats.pendingProjects} pending
                      </p>
                    </CardContent>
                  </Card>

                  {/* Approved Projects */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Approved Projects</CardTitle>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.approvedProjects}</div>
                      <p className="text-xs text-muted-foreground">
                        {stats.approvedPercentage}% of total projects
                      </p>
                    </CardContent>
                  </Card>

                  {/* Pending Projects */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Pending Projects</CardTitle>
                      <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.pendingProjects}</div>
                      <p className="text-xs text-muted-foreground">
                        {stats.pendingPercentage}% of total projects
                      </p>
                    </CardContent>
                  </Card>

                  {/* People Stats */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total People</CardTitle>
                      <Users className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.totalAuthors + stats.totalTranslators + stats.totalRightsOwners + stats.totalReviewers}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {stats.totalAuthors} authors, {stats.totalTranslators} translators, {stats.totalRightsOwners} rights owners, {stats.totalReviewers} reviewers
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Project Trends Line Chart */}
                  <Card className="col-span-1">
                    <CardHeader>
                      <CardTitle>Project Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px] w-full">
                        <LineChart
                          width={800}
                          height={400}
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
                          <Line type="monotone" dataKey="projects" stroke="#8884d8" />
                        </LineChart>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sales Trend Chart */}
                  <Card className="col-span-1">
                    <CardHeader>
                      <CardTitle>Sales & Revenue Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px] w-full">
                        <LineChart
                          width={800}
                          height={400}
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
                            name="Sales"
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="revenue"
                            stroke="#82ca9d"
                            name="Revenue ($)"
                          />
                        </LineChart>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sales by Category Chart */}
                  <Card className="col-span-1">
                    <CardHeader>
                      <CardTitle>Sales by Genre</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px] w-full">
                        <BarChart
                          width={800}
                          height={400}
                          data={salesByCategory}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="sales" fill="#8884d8" name="Sales" />
                        </BarChart>
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

