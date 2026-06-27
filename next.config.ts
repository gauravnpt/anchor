import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  // Allow long-running API routes (article generation + humanization can take 2-3 min)
  experimental: {},
};

export default nextConfig;
