"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/language-context"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const { isMobile } = useSidebar()
  const { t, dir } = useLanguage()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const themeLabel =
    theme === "light"
      ? t("theme.light")
      : theme === "dark"
        ? t("theme.dark")
        : t("theme.system")

  if (!mounted) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="pointer-events-none">
            <Sun className="size-4" />
            <span>{t("theme.label")}</span>
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
              tooltip={t("theme.label")}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <span className="relative flex size-4 shrink-0 items-center justify-center">
                <Sun className="size-4 dark:hidden" />
                <Moon className="absolute size-4 hidden dark:block" />
              </span>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">{t("theme.label")}</span>
                <span className="truncate text-xs text-muted-foreground">{themeLabel}</span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-40 rounded-lg"
            side={isMobile ? "bottom" : dir === "rtl" ? "left" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuItem onClick={() => setTheme("light")}>{t("theme.light")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>{t("theme.dark")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>{t("theme.system")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

/** Compact control for login / headers outside the sidebar. */
export function ThemeToggleButton() {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const { t } = useLanguage()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className="h-10 w-10" aria-label={t("theme.label")} disabled>
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-10 w-10"
          aria-label={t("theme.select")}
        >
          <Sun className="h-4 w-4 scale-100 dark:scale-0" />
          <Moon className="absolute h-4 w-4 scale-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>{t("theme.light")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>{t("theme.dark")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>{t("theme.system")}</DropdownMenuItem>
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          {t("theme.current")}: {theme ?? resolvedTheme ?? t("theme.system")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
