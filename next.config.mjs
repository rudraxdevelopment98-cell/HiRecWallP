/** @type {import('next').NextConfig} */

// Register the R2 public/CDN host for next/image when configured, so previews
// from the public bucket can be optimized. Originals are never served here.
const remotePatterns = [];
if (process.env.R2_PUBLIC_BASE_URL) {
  try {
    const url = new URL(process.env.R2_PUBLIC_BASE_URL);
    remotePatterns.push({ protocol: url.protocol.replace(':', ''), hostname: url.hostname });
  } catch {
    // Ignore an invalid URL; images simply won't be allowed until it's fixed.
  }
}

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns,
    // Previews are already sized/compressed at upload (≤720px, ~60 KB), so
    // skip Vercel's optimizer: its Hobby quota (5K transformations/month)
    // would otherwise break catalogue images as the library grows.
    unoptimized: true,
  },
};

export default nextConfig;
