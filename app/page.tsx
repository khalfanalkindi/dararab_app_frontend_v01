"use client"

import { AuthLoading } from "@/components/auth-loading"

/**
 * Landing route. AuthCheck sends guests to /login and signed-in users
 * to their first allowed page (typically /dashboard).
 */
export default function Home() {
  return <AuthLoading />
}
