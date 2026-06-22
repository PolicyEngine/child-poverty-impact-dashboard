/** @type {import('next').NextConfig} */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // Pin file tracing to this dir so Vercel's monorepo finalizer doesn't
  // walk up to the parent repo root looking for package.json.
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    proxyTimeout: 300000, // 5 minutes for long PolicyEngine calculations
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
