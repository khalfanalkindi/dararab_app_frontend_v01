"use client"

import type * as React from "react"
import { BookOpen, CreditCard, ShoppingCart, SquareLibrary, BookCopy, Blocks,FileSpreadsheet, Settings2, SquareTerminal, LayoutDashboard, ReceiptText } from "lucide-react"
import { useEffect, useState } from "react"

import { NavMain } from "./nav-main"
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

// This is sample data.
const data = {
  user: {
    name: "Admin",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      isActive: true,
      items: [], // Empty items array means no submenu
    },
    {
      title: "Projects",
      url: "/projects",
      icon: Blocks,
      isActive: true,
      items: [], // Empty items array means no submenu
    },
    {
      title: "Projects Contracts",
      url: "/projects-contracts",
      icon: FileSpreadsheet,
      isActive: true,
      items: [], // Empty items array means no submenu
    },
    {
      title: "Products",
      url: "/products",
      icon: BookCopy,
      isActive: true,
      items: [], // Empty items array means no submenu
    },
    {
      title: "Sales",
      url: "/pos",
      icon: ShoppingCart,
      isActive: true,
      items: [], // Empty items array means no submenu
    },
    {
      title: "Invoices",
      url: "/invoices",
      icon: ReceiptText,
      isActive: true,
      items: [], // Empty items array means no submenu
    },
    {
      title: "Outstanding Payment",
      url: "/outstanding-payment",
      icon: CreditCard,
      isActive: true,
      items: [], // Empty items array means no submenu
    },
    {
      title: "Definitions",
      url: "/definitions",
      icon: FileSpreadsheet,
      isActive: true,
      items: [
        {
          title: "Authors",
          url: "/definitions/authors",
        },
        {
          title: "Translators",
          url: "/definitions/translators",
        },
        {
          title: "Warehouses",
          url: "/definitions/warehouses",
        },
        {
          title: "Customers",
          url: "/definitions/customers",
        },
      ]
    },
    {
      title: "Reports",
      url: "/reports",
      icon: FileSpreadsheet,
      isActive: true,
      items: [
        {
          title: "Warehouse Statistics",
          url: "/reports/warehouse-stat",
        },
      ], // Empty items array means no submenu
    },
    
    // {
    //   title: "Playground",
    //   url: "#",
    //   icon: SquareTerminal,
    //   items: [
    //     {
    //       title: "History",
    //       url: "#",
    //     },
    //     {
    //       title: "Starred",
    //       url: "#",
    //     },
    //     {
    //       title: "Settings",
    //       url: "#",
    //     },
    //   ],
    // },
    // {
    //   title: "Models",
    //   url: "#",
    //   icon: Bot,
    //   items: [
    //     {
    //       title: "Genesis",
    //       url: "#",
    //     },
    //     {
    //       title: "Explorer",
    //       url: "#",
    //     },
    //     {
    //       title: "Quantum",
    //       url: "#",
    //     },
    //   ],
    // },
    // {
    //   title: "Documentation",
    //   url: "#",
    //   icon: BookOpen,
    //   items: [
    //     {
    //       title: "Introduction",
    //       url: "#",
    //     },
    //     {
    //       title: "Get Started",
    //       url: "#",
    //     },
    //     {
    //       title: "Tutorials",
    //       url: "#",
    //     },
    //     {
    //       title: "Changelog",
    //       url: "#",
    //     },
    //   ],
    // },
    // {
    //   title: "Settings",
    //   url: "#",
    //   icon: Settings2,
    //   items: [
    //     {
    //       title: "General",
    //       url: "#",
    //     },
    //     {
    //       title: "Team",
    //       url: "#",
    //     },
    //     {
    //       title: "Billing",
    //       url: "#",
    //     },
    //     {
    //       title: "Limits",
    //       url: "#",
    //     },
    //   ],
    // },
  ],
  projects: [
    {
      name: "Admin",
      url: "/admin",
      icon: Settings2,
      items: [
        {
          title: "Users",
          url: "/admin/users",
        },
        {
          title: "Roles",
          url: "/admin/roles",
        },
        {
          title: "Pages",
          url: "/admin/pages",
        },
        {
          title: "Role Permissions",
          url: "/admin/role-permissions",
        },
        {
          title: "User Permissions",
          url: "/admin/user-permissions",
        },
        {
          title: "Common Definitions",
          url: "/admin/common",
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // Track the current language to determine sidebar position
  const [sidebarSide, setSidebarSide] = useState<"left" | "right">("left")

  // Listen for changes to the document direction
  useEffect(() => {
    const handleDirChange = () => {
      const isRtl = document.documentElement.dir === "rtl"
      setSidebarSide(isRtl ? "right" : "left")
    }

    // Set initial value
    handleDirChange()

    // Create a MutationObserver to watch for changes to the dir attribute
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "dir") {
          handleDirChange()
        }
      })
    })

    // Start observing the document element
    observer.observe(document.documentElement, { attributes: true })

    // Clean up
    return () => observer.disconnect()
  }, [])

  return (
    <Sidebar collapsible="icon" side={sidebarSide} {...props}>
      <SidebarHeader>
        <LanguageIndicator />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <LanguageSwitcher />
        <SidebarSeparator />
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

