/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // TypeScript and ESLint errors block builds — this catches undefined
  // identifiers (missing imports, out-of-scope vars) that would otherwise
  // crash at runtime as "Application error: a client-side exception".
  // To temporarily bypass during a hotfix, flip these back to `true`.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Reduce client bundle size by tree-shaking these heavy imports
  experimental: {
    optimizePackageImports: ['lucide-react', '@fullcalendar/core'],
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
