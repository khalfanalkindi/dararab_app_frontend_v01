"use client"

import Link from "next/link"
import { BookMarked, Building2, Library, Users, UserSquare2 } from "lucide-react"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { DocumentTitle } from "@/components/document-title"
import { useLanguage } from "@/components/language-context"
import { PageBreadcrumb, useAppCrumbs } from "@/components/page-breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"

const links = [
  {
    href: "/definitions/authors",
    titleKey: "nav.authors" as const,
    descriptionKey: "definitions.hub.authorsDesc" as const,
    icon: Users,
  },
  {
    href: "/definitions/translators",
    titleKey: "nav.translators" as const,
    descriptionKey: "definitions.hub.translatorsDesc" as const,
    icon: UserSquare2,
  },
  {
    href: "/definitions/warehouses",
    titleKey: "nav.warehouses" as const,
    descriptionKey: "definitions.hub.warehousesDesc" as const,
    icon: Building2,
  },
  {
    href: "/definitions/customers",
    titleKey: "nav.customers" as const,
    descriptionKey: "definitions.hub.customersDesc" as const,
    icon: Library,
  },
  {
    href: "/definitions/rights_owner",
    titleKey: "nav.rightsOwners" as const,
    descriptionKey: "definitions.hub.rightsOwnersDesc" as const,
    icon: BookMarked,
  },
]

export default function DefinitionsHubPage() {
  const { t } = useLanguage()
  const { dashboard: dashboardCrumb } = useAppCrumbs()

  return (
    <ErrorBoundary>
      <DocumentTitle title={t("definitions.hub.title")} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[dashboardCrumb, { label: t("definitions.hub.title") }]} />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <div className="mb-6 flex items-start gap-3">
              <BookMarked className="mt-1 h-6 w-6 text-muted-foreground" />
              <div>
                <h2 className="text-xl font-semibold">{t("definitions.hub.title")}</h2>
                <p className="text-muted-foreground">
                  {t("definitions.hub.description")}
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
                    <h3 className="text-lg font-medium">{t(link.titleKey)}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{t(link.descriptionKey)}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </SidebarInset>
    </ErrorBoundary>
  )
}
