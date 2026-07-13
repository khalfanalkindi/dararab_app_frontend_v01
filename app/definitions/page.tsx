"use client"

import Link from "next/link"
import { BookMarked, Building2, Library, Users, UserSquare2 } from "lucide-react"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { DocumentTitle } from "@/components/document-title"
import { PageBreadcrumb, DASHBOARD_CRUMB } from "@/components/page-breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"

const links = [
  {
    href: "/definitions/authors",
    title: "Authors",
    description: "Manage book authors and their details.",
    icon: Users,
  },
  {
    href: "/definitions/translators",
    title: "Translators",
    description: "Manage translators linked to products and projects.",
    icon: UserSquare2,
  },
  {
    href: "/definitions/warehouses",
    title: "Warehouses",
    description: "Configure warehouse locations and settings.",
    icon: Building2,
  },
  {
    href: "/definitions/customers",
    title: "Customers",
    description: "Institutions and contacts used in sales invoices.",
    icon: Library,
  },
  {
    href: "/definitions/rights_owner",
    title: "Rights Owners",
    description: "Manage rights owners for publishing contracts.",
    icon: BookMarked,
  },
]

export default function DefinitionsHubPage() {
  return (
    <ErrorBoundary>
      <DocumentTitle title="Definitions" />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[DASHBOARD_CRUMB, { label: "Definitions" }]} />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <div className="mb-6 flex items-start gap-3">
              <BookMarked className="mt-1 h-6 w-6 text-muted-foreground" />
              <div>
                <h2 className="text-xl font-semibold">Definitions</h2>
                <p className="text-muted-foreground">
                  Master data used across catalog, sales, and publishing.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
