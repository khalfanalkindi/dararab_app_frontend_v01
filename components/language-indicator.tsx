"use client"

import { SquareLibrary } from "lucide-react"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { useLanguage } from "@/components/language-context"

export function LanguageIndicator() {
  const { t } = useLanguage()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="pointer-events-none" tooltip={t("brand.name")}>
          <SquareLibrary className="size-4 shrink-0" />
          <div className="grid flex-1 text-start text-sm leading-tight">
            <span className="truncate font-semibold">{t("brand.name")}</span>
            <span className="truncate text-xs">{t("brand.system")}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
