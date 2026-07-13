"use client"

import type * as React from "react"
import {
  BarChart3,
  Blocks,
  BookCopy,
  BookMarked,
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

const data = {
  navGroups: [
    // One-click access — Dashboard + POS
    {
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
          items: [] as { title: string; url: string }[],
        },
        {
          title: "Point of Sale",
          url: "/pos",
          icon: ShoppingCart,
          items: [] as { title: string; url: string }[],
        },
      ],
    },
    // Sections: icon + title once, then children (no duplicate group label)
    {
      items: [
        {
          title: "Publishing",
          url: "/projects",
          icon: Blocks,
          items: [
            { title: "Projects", url: "/projects" },
            { title: "Project Contracts", url: "/projects-contracts" },
          ],
        },
        {
          title: "Catalog",
          url: "/products",
          icon: BookCopy,
          items: [
            { title: "Products", url: "/products" },
            { title: "Inventory", url: "/inventory" },
            { title: "Transfer", url: "/transfer" },
          ],
        },
        {
          title: "Sales",
          url: "/invoices",
          icon: FileText,
          items: [
            { title: "Invoices", url: "/invoices" },
            { title: "Outstanding Payment", url: "/outstanding-payment" },
          ],
        },
        {
          title: "Reports",
          url: "/reports",
          icon: BarChart3,
          items: [
            { title: "Overview", url: "/reports" },
            { title: "Warehouse Statistics", url: "/reports/warehouse-stat" },
            { title: "Royalties Calculation", url: "/reports/royalties" },
          ],
        },
        {
          title: "Definitions",
          url: "/definitions",
          icon: BookMarked,
          items: [
            { title: "Overview", url: "/definitions" },
            { title: "Authors", url: "/definitions/authors" },
            { title: "Translators", url: "/definitions/translators" },
            { title: "Warehouses", url: "/definitions/warehouses" },
            { title: "Customers", url: "/definitions/customers" },
            { title: "Rights Owners", url: "/definitions/rights_owner" },
          ],
        },
      ],
    },
  ] satisfies NavMainGroup[],
  projects: [
    {
      name: "Admin",
      url: "/admin",
      icon: Settings2,
      items: [
        { title: "Users", url: "/admin/users" },
        { title: "Roles", url: "/admin/roles" },
        { title: "Pages", url: "/admin/pages" },
        { title: "Role Permissions", url: "/admin/role-permissions" },
        { title: "User Permissions", url: "/admin/user-permissions" },
        { title: "Common Definitions", url: "/admin/common" },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { dir } = useLanguage()
  const perms = usePermissionsOptional()
  const sidebarSide = dir === "rtl" ? "right" : "left"

  const navGroups = useMemo(() => {
    return data.navGroups
      .map((group) => ({
        ...group,
        items: filterNavByPermissions(group.items, perms?.permissions ?? null),
      }))
      .filter((group) => group.items.length > 0)
  }, [perms?.permissions])

  const projects = useMemo(
    () => filterAdminNavByPermissions(data.projects, perms?.permissions ?? null),
    [perms?.permissions],
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
