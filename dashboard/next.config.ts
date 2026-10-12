import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: process.env['DOCKER_BUILD'] === '1' ? 'standalone' : undefined,
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['@agencyforge/website-builder'],
};

export default nextConfig;
