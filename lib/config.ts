/**
 * Application configuration
 * 
 * API URL should be set via NEXT_PUBLIC_API_URL environment variable.
 * For local development, create a .env.local file with:
 * NEXT_PUBLIC_API_URL=http://localhost:8000/api
 * 
 * In production, this should be set via deployment platform environment variables.
 */

const DEFAULT_API_URL =
  "https://dararabappbackendv01-production.up.railway.app/api"

function normalizeApiUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, "")

  try {
    const url = new URL(trimmed)

    // Railway serves public applications over HTTPS. An HTTP URL is blocked
    // by both CSP and mixed-content protection on the production frontend.
    if (url.hostname.endsWith(".up.railway.app")) {
      url.protocol = "https:"
    }

    if (url.pathname === "" || url.pathname === "/") {
      url.pathname = "/api"
    }

    return url.toString().replace(/\/+$/, "")
  } catch {
    // Preserve relative/custom URLs while keeping endpoint joins predictable.
    return trimmed
  }
}

export const API_URL = normalizeApiUrl(
  process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULT_API_URL,
)

