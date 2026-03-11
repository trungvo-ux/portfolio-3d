import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingRoot: process.cwd(),
  turbopack: {},
  experimental: {
    cpus: 1,
  },
  webpack: (config) => {
    config.parallelism = 1;
    if (config.optimization) {
      config.optimization.minimize = false;
    }
    return config;
  },
};

export default nextConfig;
