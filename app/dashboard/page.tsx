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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"

interface DashboardStats {
  totalProjects: number
  approvedProjects: number
  pendingProjects: number
  totalAuthors: number
  totalTranslators: number
  totalRightsOwners: number
  totalReviewers: number
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
  })
  const [isLoading, setIsLoading] = useState(true)

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
        const projects = await projectsRes.json()
        const approvedProjects = projects.filter((p: any) => p.approval_status).length

        // Fetch authors
        const authorsRes = await fetch(`${API_URL}/inventory/authors/`, { headers })
        const authors = await authorsRes.json()

        // Fetch translators
        const translatorsRes = await fetch(`${API_URL}/inventory/translators/`, { headers })
        const translators = await translatorsRes.json()

        // Fetch rights owners
        const rightsOwnersRes = await fetch(`${API_URL}/inventory/rights-owners/`, { headers })
        const rightsOwners = await rightsOwnersRes.json()

        // Fetch reviewers
        const reviewersRes = await fetch(`${API_URL}/inventory/reviewers/`, { headers })
        const reviewers = await reviewersRes.json()

        setStats({
          totalProjects: projects.length,
          approvedProjects,
          pendingProjects: projects.length - approvedProjects,
          totalAuthors: authors.length,
          totalTranslators: translators.length,
          totalRightsOwners: rightsOwners.length,
          totalReviewers: reviewers.length,
        })
      } catch (error) {
        console.error("Error fetching dashboard stats:", error)
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                      {((stats.approvedProjects / stats.totalProjects) * 100).toFixed(1)}% of total projects
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
                      {((stats.pendingProjects / stats.totalProjects) * 100).toFixed(1)}% of total projects
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
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

