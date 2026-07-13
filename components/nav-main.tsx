"use client"

import Link from "next/link"
import { ChevronDown, type LucideIcon } from "lucide-react"
import { usePathname } from "next/navigation"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export type NavMainItem = {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  items?: {
    title: string
    url: string
  }[]
}

export type NavMainGroup = {
  label: string
  items: NavMainItem[]
}

function pathMatches(pathname: string, url: string) {
  if (pathname === url) return true
  if (url !== "/" && pathname.startsWith(`${url}/`)) return true
  return false
}

export function NavMain({ groups }: { groups: NavMainGroup[] }) {
  const pathname = usePathname()

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => {
              const hasSubItems = Boolean(item.items && item.items.length > 0)
              const isItemActive = pathMatches(pathname, item.url)
              const isSubItemActive = item.items?.some((sub) => pathMatches(pathname, sub.url))
              const isActive = isItemActive || Boolean(isSubItemActive)

              if (hasSubItems) {
                return (
                  <Collapsible
                    key={item.title}
                    defaultOpen={isActive}
                    className="group/collapsible w-full"
                  >
                    <SidebarMenuItem>
                      <div className="flex w-full items-center">
                        <SidebarMenuButton
                          asChild
                          tooltip={item.title}
                          isActive={isItemActive}
                          className="flex-1"
                        >
                          <Link href={item.url}>
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                        <CollapsibleTrigger className="inline-flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-sidebar-accent">
                          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=closed]/collapsible:rotate-[-90deg]" />
                          <span className="sr-only">Toggle {item.title}</span>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items?.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathMatches(pathname, subItem.url)}
                              >
                                <Link href={subItem.url}>
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              }

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                    <Link href={item.url}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
