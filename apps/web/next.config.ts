import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@trainiq/types",
    "@trainiq/domain",
    "@trainiq/recommendation",
    "@trainiq/intervals",
    "@trainiq/weather",
  ],
};

export default nextConfig;
