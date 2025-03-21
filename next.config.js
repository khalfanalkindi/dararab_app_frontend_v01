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
            //value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ws:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-src 'self'"
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' 'inline-speculation-rules';
              style-src 'self' 'unsafe-inline';
              img-src 'self' data:;
              font-src 'self' data:;
              connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 ws:;
              frame-src 'self'
            `.replace(/\n/g, ""),
          }
        ]
      }
    ]
  },
  // Ensure webpack doesn't split chunks too aggressively
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Prevent splitting into too many chunks
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Create a single chunk for all modules
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 1,
            reuseExistingChunk: true,
          },
        },
      };
    }
    return config;
  },
}

module.exports = nextConfig