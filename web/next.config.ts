import type { NextConfig } from 'next';

// Where the Express API lives, as seen from the Next.js server (not the browser).
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // The browser only ever talks to this Next.js server. /api/* is forwarded to Express, so the
  // session cookie is same-origin (httpOnly, no CORS). See docs/DESIGN.md §9.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
