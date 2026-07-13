"use client"

import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"

const SHELL_EXEMPT_PREFIXES = ["/login"]

function isShellExempt(pathname: string | null): boolean {
  const path = pathname || "/"
  return SHELL_EXEMPT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  )
}

/**
 * Single app chrome: one SidebarProvider + AppSidebar for authenticated routes.
 * Login renders children only (no sidebar nesting).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (isShellExempt(pathname)) {
    return <>{children}</>
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      {children}
    </SidebarProvider>
  )
}
