"use client"

import * as React from "react"
import { SquareLibrary } from "lucide-react"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { LANGUAGE_COOKIE, normalizeLanguage } from "@/lib/language"

export function LanguageIndicator() {
  const [language, setLanguage] = React.useState("en")

  React.useEffect(() => {
    setLanguage(normalizeLanguage(localStorage.getItem(LANGUAGE_COOKIE)))
  }, [])

  // Listen for language changes from the main language switcher
  React.useEffect(() => {
    const handleLanguageChange = () => {
      setLanguage(document.documentElement.lang)
    }

    handleLanguageChange()

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "lang") {
          handleLanguageChange()
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })

    return () => observer.disconnect()
  }, [])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="pointer-events-none">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-black text-white">
            <SquareLibrary className="size-4" />
          </div>
          <div className="grid flex-1 text-start text-sm leading-tight">
            <span className="truncate font-semibold">{language === "en" ? "DarArab" : "دار عرب"}</span>
            <span className="truncate text-xs">{language === "en" ? "Management System" : "نظام الإدارة"}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
