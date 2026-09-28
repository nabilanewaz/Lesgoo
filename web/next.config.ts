import type { NextConfig } from 'next';

// Where the Express API lives, as seen from the Next.js server (not the browser). Read at BUILD
// time (rewrites are compiled into the build), so the Docker image gets it as a build argument.
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone, so the Docker image ships no node_modules.
  output: 'standalone',
  // The browser only ever talks to this Next.js server. /api/* is forwarded to Express, so the
  // session cookie is same-origin (httpOnly, no CORS). See docs/DESIGN.md §9.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
