import type React from "react"
import "./globals.css"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { AuthCheck } from "@/components/auth-check"
import { headers } from 'next/headers'

// Add headers configuration
export async function generateMetadata() {
  return {
    title: "DarArab for Publishing and Translation",
    description: "DarArab for Publishing and Translation",
    generator: 'v1.0'
  }
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