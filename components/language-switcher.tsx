"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import {
  LANGUAGE_COOKIE,
  type AppLanguage,
  normalizeLanguage,
  persistLanguage,
} from "@/lib/language";

export function LanguageSwitcher() {
  const { isMobile } = useSidebar();
  const [language, setLanguage] = React.useState<AppLanguage>("en");

  React.useEffect(() => {
    const storedLanguage = normalizeLanguage(localStorage.getItem(LANGUAGE_COOKIE));
    setLanguage(storedLanguage);
    persistLanguage(storedLanguage);
  }, []);

  const handleLanguageChange = (lang: AppLanguage) => {
    setLanguage(lang);
    persistLanguage(lang);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-black text-white">
                <Globe className="size-4" />
              </div>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">{language === "en" ? "Change Language" : "تغيير اللغة"}</span>
                <span className="truncate text-xs">{language === "en" ? "English" : "العربية"}</span>
              </div>
              <ChevronsUpDown className="ms-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg" align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {language === "en" ? "Select Language" : "اختر اللغة"}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleLanguageChange("en")} className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-sm border">
                <Globe className="size-4 shrink-0" />
              </div>
              {language === "en" ? "English" : "الإنجليزية"}
              {language === "en" && <Check className="ms-auto" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLanguageChange("ar")} className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-sm border">
                <Globe className="size-4 shrink-0" />
              </div>
              {language === "en" ? "Arabic" : "العربية"}
              {language === "ar" && <Check className="ms-auto" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
