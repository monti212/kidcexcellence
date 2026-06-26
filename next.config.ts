import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace/tracing root to this project. Stray lockfiles in parent
  // directories otherwise make Next infer C:\Users\monti as the root, which bakes
  // backslash-laden Windows paths into the traced server bundle and breaks the
  // Netlify Linux function at runtime (ERR_MODULE_NOT_FOUND).
  outputFileTracingRoot: __dirname,
  outputFileTracingExcludes: {
    "/*": ["./data/*.json"],
  },
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
