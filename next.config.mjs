/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Public previews are served from the R2 public bucket behind a CDN.
    // Add the configured public base URL host at runtime via remotePatterns.
    remotePatterns: [
      // Example (filled from R2_PUBLIC_BASE_URL in deployment):
      // { protocol: 'https', hostname: 'cdn.hirecwallp.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    // Keep server actions/body limits tight; previews are generated server-side.
  },
};

export default nextConfig;
