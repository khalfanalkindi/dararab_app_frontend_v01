"use client"

import { ErrorBoundary } from "@/components/ErrorBoundary"
import { DocumentTitle } from "@/components/document-title"
import Link from "next/link"
import { PageBreadcrumb, useAppCrumbs } from "@/components/page-breadcrumb"
import { useLanguage } from "@/components/language-context"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"

export default function Page() {
  const { t } = useLanguage()
  const { dashboard: dashboardCrumb } = useAppCrumbs()

  const links = [
    {
      href: "/admin/users",
      title: t("nav.users"),
      description: t("admin.hub.usersDesc"),
    },
    {
      href: "/admin/roles",
      title: t("nav.roles"),
      description: t("admin.hub.rolesDesc"),
    },
    {
      href: "/admin/pages",
      title: t("nav.pages"),
      description: t("admin.hub.pagesDesc"),
    },
    {
      href: "/admin/role-permissions",
      title: t("nav.rolePermissions"),
      description: t("admin.hub.rolePermissionsDesc"),
    },
    {
      href: "/admin/user-permissions",
      title: t("nav.userPermissions"),
      description: t("admin.hub.userPermissionsDesc"),
    },
    {
      href: "/admin/common",
      title: t("nav.commonDefinitions"),
      description: t("admin.hub.commonDesc"),
    },
  ]

  return (
    <ErrorBoundary>
      <DocumentTitle title={t("admin.hub.title")} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[dashboardCrumb, { label: t("admin.hub.title") }]} />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <h2 className="mb-2 text-xl font-semibold">{t("admin.hub.title")}</h2>
            <p className="text-muted-foreground">{t("admin.hub.description")}</p>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <h3 className="mb-2 text-lg font-medium">{link.title}</h3>
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
