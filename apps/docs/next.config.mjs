import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // docs.mcpx.gg is a standalone static-leaning site; no server actions needed.
  experimental: {},
};

export default withMDX(config);
