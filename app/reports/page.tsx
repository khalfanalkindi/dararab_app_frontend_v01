"use client"

import Link from "next/link"
import { BarChart3, Calculator, Warehouse } from "lucide-react"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { DocumentTitle } from "@/components/document-title"
import { PageBreadcrumb, DASHBOARD_CRUMB } from "@/components/page-breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"

const links = [
  {
    href: "/reports/warehouse-stat",
    title: "Warehouse Statistics",
    description: "Sales and stock performance by warehouse and date range.",
    icon: Warehouse,
  },
  {
    href: "/reports/royalties",
    title: "Royalties Calculation",
    description: "Calculate royalties for contracts and projects.",
    icon: Calculator,
  },
]

export default function ReportsHubPage() {
  return (
    <ErrorBoundary>
      <DocumentTitle title="Reports" />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[DASHBOARD_CRUMB, { label: "Reports" }]} />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <div className="mb-6 flex items-start gap-3">
              <BarChart3 className="mt-1 h-6 w-6 text-muted-foreground" />
              <div>
                <h2 className="text-xl font-semibold">Reports</h2>
                <p className="text-muted-foreground">
                  Choose a report to explore warehouse performance or royalties.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <link.icon className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">{link.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{link.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </SidebarInset>
    </ErrorBoundary>
  )
}
