import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Set CSP headers with a more permissive configuration
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "connect-src 'self' http://127.0.0.1:8000 http://localhost:8000 https://dararabappbackendv01-production.up.railway.app https://dararabappbackendv01-dev.up.railway.app ws: wss:; " +
    "img-src 'self' data: blob: https://dararab.co.uk https://www.dararab.co.uk; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' 'inline-speculation-rules'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "font-src 'self' data:; " +
    "frame-src 'self'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  )

  return response
}

export const config = {
  matcher: '/:path*',
} 
