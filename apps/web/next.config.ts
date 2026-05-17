import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source (main → ./src/index.ts);
  // Next/Turbopack must transpile them rather than expect prebuilt JS.
  transpilePackages: ["@mcpxgg/walrus", "@mcpxgg/chain", "@mcpxgg/shared"],
};

export default nextConfig;
