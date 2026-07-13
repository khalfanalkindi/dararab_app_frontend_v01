import type React from "react"
import { cookies } from "next/headers"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { AuthCheck } from "@/components/auth-check"
import { AppShell } from "@/components/app-shell"
import { ThemeProvider } from "@/components/theme-provider"
import { LanguageProvider } from "@/components/language-context"
import {
  LANGUAGE_COOKIE,
  languageDir,
  normalizeLanguage,
} from "@/lib/language"

export async function generateMetadata() {
  return {
    title: {
      default: "DarArab for Publishing and Translation",
      template: "%s | DarArab",
    },
    description: "DarArab for Publishing and Translation",
    generator: "v1.0",
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const lang = normalizeLanguage(cookieStore.get(LANGUAGE_COOKIE)?.value)
  const dir = languageDir(lang)

  return (
    <html lang={lang} dir={dir} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <LanguageProvider>
            <AuthCheck>
              <AppShell>{children}</AppShell>
              <Toaster />
            </AuthCheck>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
