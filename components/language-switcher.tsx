"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Globe } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import type { AppLanguage } from "@/lib/language"
import { useLanguage } from "@/components/language-context"

export function LanguageSwitcher() {
  const { isMobile } = useSidebar()
  const { language, setLanguage, t, dir } = useLanguage()

  const handleLanguageChange = (lang: AppLanguage) => {
    setLanguage(lang)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={t("language.label")}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Globe className="size-4 shrink-0" />
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">{t("language.change")}</span>
                <span className="truncate text-xs">
                  {language === "en" ? t("language.english") : t("language.arabic")}
                </span>
              </div>
              <ChevronsUpDown className="ms-auto size-4 shrink-0 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : dir === "rtl" ? "left" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t("language.select")}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleLanguageChange("en")} className="gap-2 p-2">
              <Globe className="size-4 shrink-0" />
              {t("language.english")}
              {language === "en" && <Check className="ms-auto" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLanguageChange("ar")} className="gap-2 p-2">
              <Globe className="size-4 shrink-0" />
              {t("language.arabic")}
              {language === "ar" && <Check className="ms-auto" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
