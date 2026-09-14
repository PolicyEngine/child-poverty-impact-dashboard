/** @type {import('next').NextConfig} */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

// Canonical public URL: policyengine.org/us/child-poverty-impact-dashboard,
// served through the app-zone rewrite in policyengine-app-v2. The app serves
// under this basePath everywhere (including the Vercel domain and local dev)
// so proxied assets and routes resolve — the same pattern as the other
// mounted apps (keep-your-pay-act etc.).
const BASE_PATH = '/us/child-poverty-impact-dashboard';

const nextConfig = {
  reactStrictMode: true,
  basePath: BASE_PATH,
  // Client code that builds URLs or fetches public/ assets by hand (raw
  // <img>, geojson fetch, share links) prefixes with this.
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
  // Pin file tracing to this dir so Vercel's monorepo finalizer doesn't
  // walk up to the parent repo root looking for package.json.
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    proxyTimeout: 300000, // 5 minutes for long PolicyEngine calculations
  },
  async redirects() {
    // Legacy pre-basePath links (shared ?r=/?c= URLs, bookmarks) still hit
    // the old root paths on the Vercel domain; basePath: false lets these
    // sources match outside the prefix. Query strings carry over.
    return [
      ...['/', '/report', '/report/results', '/about', '/analyze', '/compare'].map(
        (source) => ({
          source,
          destination: `${BASE_PATH}${source === '/' ? '' : source}`,
          basePath: false,
          permanent: false,
        }),
      ),
    ];
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
