"use client"

import { ChevronsUpDown, LogOut, User } from "lucide-react"
import { useLanguage } from "./language-context"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { API_URL } from "@/lib/config"
import { clearSession, fetchWithRetry } from "@/lib/apiClient"
import {
  cacheUserData,
  mapToSidebarUser,
  readCachedSidebarUser,
  type SidebarUser,
} from "@/lib/user-profile"

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
  }
  return (name.slice(0, 2) || "?").toUpperCase()
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const { dir } = useLanguage()
  const router = useRouter()
  const [user, setUser] = useState<SidebarUser | null>(null)

  useEffect(() => {
    const cached = readCachedSidebarUser()
    if (cached) {
      setUser(cached)
    }

    let cancelled = false

    const loadProfile = async () => {
      try {
        const token = localStorage.getItem("accessToken")
        if (!token) return

        const response = await fetchWithRetry(`${API_URL}/auth/me/`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        })
        if (!response.ok) return

        const data = (await response.json()) as Record<string, unknown>
        if (cancelled) return

        cacheUserData(data)
        setUser(mapToSidebarUser(data))
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to load sidebar user profile:", error)
        }
      }
    }

    void loadProfile()
    return () => {
      cancelled = true
    }
  }, [])

  const handleLogout = async () => {
    const accessToken = localStorage.getItem("accessToken")
    const refreshToken = localStorage.getItem("refreshToken")

    if (refreshToken) {
      try {
        await fetchWithRetry(`${API_URL}/auth/logout/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ refresh: refreshToken }),
          skipSessionHandling: true,
        })
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Error during logout:", error)
        }
      }
    }

    clearSession()
    window.location.href = "/login"
  }

  const navigateToAccount = () => {
    router.push("/account")
  }

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="pointer-events-none">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="grid flex-1 gap-1.5 text-start">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={user.name}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
                <AvatarFallback className="rounded-lg text-[10px]">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ms-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
                  <AvatarFallback className="rounded-lg">{initials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-start text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={navigateToAccount}>
                <User className="mr-2 h-4 w-4" />
                {dir === "rtl" ? "حسابي" : "My Account"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              {dir === "rtl" ? "تسجيل الخروج" : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
