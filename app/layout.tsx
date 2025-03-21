import type React from "react"
import "./globals.css"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { AuthCheck } from "@/components/auth-check"

export const metadata = {
  title: "Admin Dashboard",
  description: "Admin dashboard with language switching and user management",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthCheck>
          <SidebarProvider>
            {children}
            <Toaster />
          </SidebarProvider>
        </AuthCheck>
      </body>
    </html>
  )
}



import './globals.css'