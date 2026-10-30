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
    "/graph": ["./drizzle/**/*"],
  },
  outputFileTracingExcludes: {
    "*": ["./design/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  webpack: (config) => {
    const ignored = config.watchOptions?.ignored;
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        ...(Array.isArray(ignored) ? ignored : ignored ? [ignored] : []),
        "**/design/**",
      ],
    };
    return config;
  },
};

export default nextConfig;
