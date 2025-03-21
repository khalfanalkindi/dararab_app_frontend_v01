"use client"

import { BadgeCheck, ChevronsUpDown, LogOut, User } from "lucide-react"
import { useLanguage } from "./language-context"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

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

// Replace this with your API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://your-api-url.com/api"

export function NavUser({
  user: defaultUser,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const { dir } = useLanguage()
  const router = useRouter()
  const [user, setUser] = useState(defaultUser)

  // Load user data from localStorage if available
  useEffect(() => {
    const storedUserData = localStorage.getItem("userData")
    if (storedUserData) {
      try {
        const userData = JSON.parse(storedUserData)
        setUser({
          name: userData.name || userData.username || defaultUser.name,
          email: userData.email || defaultUser.email,
          avatar: userData.avatar || defaultUser.avatar,
        })
      } catch (error) {
        console.error("Error parsing user data:", error)
      }
    }
  }, [defaultUser])

  const handleLogout = async () => {
    const accessToken = localStorage.getItem("accessToken")
    const refreshToken = localStorage.getItem("refreshToken")

    if (refreshToken) {
      try {
        // ✅ Call the Logout API
        const response = await fetch(`${API_URL}/auth/logout/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`, // ✅ Send access token
          },
          body: JSON.stringify({ refresh_token: refreshToken }), // ✅ Send refresh token
        })

        if (!response.ok) {
          throw new Error("Logout failed.")
        }
      } catch (error) {
        console.error("Error during logout:", error)
      }
    }

    // ✅ Clear all authentication data
    localStorage.removeItem("accessToken")
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("userData")

    // ✅ Redirect to login
    window.location.href = "/login"
  }

  const navigateToAccount = () => {
    router.push("/account")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className={`${dir === "rtl" ? "mr-auto" : "ml-auto"} size-4`} />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
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
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <BadgeCheck className="mr-2 h-4 w-4" />
                {dir === "rtl" ? "الإعدادات" : "Settings"}
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

