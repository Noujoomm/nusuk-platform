/** @type {import('next').NextConfig} */
const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://localhost:4000';

const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Increase proxy timeout for large file uploads
  httpAgentOptions: {
    keepAlive: true,
  },
  experimental: {
    proxyTimeout: 600000, // 10 minutes
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_INTERNAL}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${API_INTERNAL}/uploads/:path*`,
      },
      {
        source: '/health',
        destination: `${API_INTERNAL}/health`,
      },
      {
        // Socket.IO traffic. NOTE: Next.js rewrites only proxy HTTP — they
        // do NOT forward WebSocket Upgrade headers. So this rewrite handles
        // the long-polling transport perfectly, but the `wss://` upgrade
        // attempt that Socket.IO makes after the polling handshake will be
        // dropped by the edge. The client (apps/web/src/lib/socket.ts) is
        // configured `transports: ['polling', 'websocket']` so it stays on
        // polling when the upgrade is blocked. Fully functional, just slower
        // per event. A proper WS proxy would need a custom server.js wrapping
        // the Next.js standalone build (deferred — separate refactor).
        source: '/socket.io/:path*',
        destination: `${API_INTERNAL}/socket.io/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
