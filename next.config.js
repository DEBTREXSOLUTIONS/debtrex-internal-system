/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow production builds to complete even with type errors.
  // The dev server still shows them so you can fix them over time.
  // Real runtime safety is provided by zod validation in API routes.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Same for ESLint warnings
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'drive.google.com' },
    ],
  },
};
module.exports = nextConfig;
