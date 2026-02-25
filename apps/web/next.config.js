/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel handles output automatically — standalone only for Docker
  ...(process.env.DOCKER_BUILD === 'true'
    ? {
        output: 'standalone',
      }
    : {}),
  images: {
    remotePatterns: [],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
