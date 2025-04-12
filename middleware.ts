import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Set CSP headers with a more permissive configuration
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self' http://127.0.0.1:8000; " +
    "connect-src 'self' http://127.0.0.1:8000; " +
    "img-src 'self' data: http://127.0.0.1:8000; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' 'inline-speculation-rules' chrome-extension://*; " +
    "style-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
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