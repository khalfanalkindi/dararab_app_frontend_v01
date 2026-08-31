"use client"

import type * as React from "react"
import {
  BarChart3,
  Blocks,
  BookCopy,
  BookMarked,
  DollarSign,
  FileText,
  LayoutDashboard,
  Settings2,
  ShoppingCart,
} from "lucide-react"
import { useMemo } from "react"

import { NavMain, type NavMainGroup } from "./nav-main"
import { NavProjects } from "./nav-projects"
import { NavUser } from "./nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { LanguageSwitcher } from "./language-switcher"
import { LanguageIndicator } from "./language-indicator"
import { ThemeToggle } from "./theme-toggle"
import { useLanguage } from "./language-context"
import { usePermissionsOptional } from "@/components/permissions-provider"
import { filterAdminNavByPermissions, filterNavByPermissions } from "@/lib/permissions"
import type { TranslateFn } from "@/lib/i18n"

function buildNavGroups(t: TranslateFn): NavMainGroup[] {
  return [
    {
      items: [
        {
          title: t("nav.dashboard"),
          url: "/dashboard",
          icon: LayoutDashboard,
          items: [],
        },
        {
          title: t("nav.pos"),
          url: "/pos",
          icon: ShoppingCart,
          items: [],
        },
      ],
    },
    {
      items: [
        {
          title: t("nav.publishing"),
          url: "/projects",
          icon: Blocks,
          items: [
            { title: t("nav.projects"), url: "/projects" },
            { title: t("nav.projectContracts"), url: "/projects-contracts" },
          ],
        },
        {
          title: t("nav.catalog"),
          url: "/products",
          icon: BookCopy,
          items: [
            { title: t("nav.products"), url: "/products" },
            { title: t("nav.inventory"), url: "/inventory" },
            { title: t("nav.stockWriteoffs"), url: "/inventory/writeoffs" },
            { title: t("nav.transfer"), url: "/transfer" },
          ],
        },
        {
          title: t("nav.sales"),
          url: "/invoices",
          icon: FileText,
          items: [
            { title: t("nav.invoices"), url: "/invoices" },
            { title: t("nav.outstandingPayment"), url: "/outstanding-payment" },
          ],
        },
        {
          title: t("nav.reports"),
          url: "/reports",
          icon: BarChart3,
          items: [
            { title: t("nav.reportsOverview"), url: "/reports" },
            { title: t("nav.warehouseStatistics"), url: "/reports/warehouse-stat" },
            { title: t("nav.bookSalesAnalytics"), url: "/reports/book-sales" },
          ],
        },
        {
          title: t("nav.royalties"),
          url: "/royalties",
          icon: DollarSign,
          items: [
            { title: t("nav.royaltiesCalculation"), url: "/royalties" },
            { title: t("nav.royaltiesHistory"), url: "/royalties/history" },
          ],
        },
        {
          title: t("nav.definitions"),
          url: "/definitions",
          icon: BookMarked,
          items: [
            { title: t("nav.definitionsOverview"), url: "/definitions" },
            { title: t("nav.authors"), url: "/definitions/authors" },
            { title: t("nav.translators"), url: "/definitions/translators" },
            { title: t("nav.warehouses"), url: "/definitions/warehouses" },
            { title: t("nav.customers"), url: "/definitions/customers" },
            { title: t("nav.rightsOwners"), url: "/definitions/rights_owner" },
          ],
        },
      ],
    },
  ]
}

function buildAdminNav(t: TranslateFn) {
  return [
    {
      name: t("nav.admin"),
      url: "/admin",
      icon: Settings2,
      items: [
        { title: t("nav.users"), url: "/admin/users" },
        { title: t("nav.roles"), url: "/admin/roles" },
        { title: t("nav.pages"), url: "/admin/pages" },
        { title: t("nav.rolePermissions"), url: "/admin/role-permissions" },
        { title: t("nav.userPermissions"), url: "/admin/user-permissions" },
        { title: t("nav.commonDefinitions"), url: "/admin/common" },
      ],
    },
  ]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { dir, t, language } = useLanguage()
  const perms = usePermissionsOptional()
  const sidebarSide = dir === "rtl" ? "right" : "left"

  const navGroups = useMemo(() => {
    return buildNavGroups(t)
      .map((group) => ({
        ...group,
        items: filterNavByPermissions(group.items, perms?.permissions ?? null),
      }))
      .filter((group) => group.items.length > 0)
  }, [perms?.permissions, t, language])

  const projects = useMemo(
    () => filterAdminNavByPermissions(buildAdminNav(t), perms?.permissions ?? null),
    [perms?.permissions, t, language],
  )

  return (
    <Sidebar collapsible="icon" side={sidebarSide} {...props}>
      <SidebarHeader>
        <LanguageIndicator />
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={navGroups} />
        {projects.length > 0 ? <NavProjects projects={projects} /> : null}
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggle />
        <LanguageSwitcher />
        <SidebarSeparator />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
