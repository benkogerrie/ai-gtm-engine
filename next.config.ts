import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["@electric-sql/pglite", "drizzle-orm", "pg"],
  outputFileTracingIncludes: {
    "/api/**": ["./drizzle/**/*"],
    "/intake": ["./drizzle/**/*"],
    "/icp/[id]": ["./drizzle/**/*"],
    "/login": ["./drizzle/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
