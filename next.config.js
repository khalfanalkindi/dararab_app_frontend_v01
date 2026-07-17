/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable CSP during development
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://127.0.0.1:8000 http://localhost:8000 https://dararabappbackendv01-production.up.railway.app https://dararabappbackendv01-dev.up.railway.app ws: wss:; frame-src 'self'"
          }
        ]
      }
    ]
  },
}

module.exports = nextConfig