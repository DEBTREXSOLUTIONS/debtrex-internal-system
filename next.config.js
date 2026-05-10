/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow production builds to complete even with type errors.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Reduce client bundle size by tree-shaking these heavy imports
  experimental: {
    optimizePackageImports: ['lucide-react', '@fullcalendar/core', 'date-fns', 'recharts'],
  },
  // Compress responses
  compress: true,
  // Cache static assets aggressively
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'drive.google.com' },
    ],
  },
};
module.exports = nextConfig;
