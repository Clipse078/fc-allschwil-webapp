import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // file-type is an ESM-only package; transpile it so Next.js can bundle it
  // in server routes without module format conflicts.
  transpilePackages: ["file-type"],

  images: {
    // Vercel Blob CDN domain for tenant logo storage.
    // The blob subdomain is store-specific, so we use a pattern match.
    // TenantLogo currently uses a plain <img> tag (no Next.js Image optimizer),
    // but this is declared here for future migration and CSP documentation.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
