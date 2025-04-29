"use client"

import * as React from "react"
import { SquareLibrary } from "lucide-react"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

export function LanguageIndicator() {
  const [language, setLanguage] = React.useState("en")

  // Initialize language from localStorage on component mount
  React.useEffect(() => {
    const storedLanguage = localStorage.getItem("preferredLanguage")
    if (storedLanguage) {
      setLanguage(storedLanguage)
    }
  }, [])

  // Listen for language changes from the main language switcher
  React.useEffect(() => {
    const handleLanguageChange = () => {
      setLanguage(document.documentElement.lang)
    }

    // Set initial value
    handleLanguageChange()

    // Listen for changes to the lang attribute
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "lang") {
          handleLanguageChange()
        }
      })
    })

    // Start observing
    observer.observe(document.documentElement, { attributes: true })

    // Clean up
    return () => observer.disconnect()
  }, [])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="pointer-events-none">
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-black text-white">
            <SquareLibrary className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{language === "en" ? "DarArab" : "دار عرب"}</span>
            <span className="truncate text-xs">{language === "en" ? "Management System" : "نظام الإدارة"}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

