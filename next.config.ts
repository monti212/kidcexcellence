import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace/tracing root to this project. Stray lockfiles in parent
  // directories otherwise make Next infer C:\Users\monti as the root, which bakes
  // backslash-laden Windows paths into the traced server bundle and breaks the
  // Netlify Linux function at runtime (ERR_MODULE_NOT_FOUND).
  outputFileTracingRoot: __dirname,
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
};

export default nextConfig;
