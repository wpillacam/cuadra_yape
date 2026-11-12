const path = require('node:path');
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: false,
  dynamicStartUrl: false,
  skipWaiting: true,
  runtimeCaching: [],
  // The App Router build manifest is server-only and would fail precaching.
  buildExcludes: [/app-build-manifest\.json$/],
});

module.exports = withPWA({
  reactStrictMode: true,
  images: { unoptimized: true },
  experimental: { outputFileTracingRoot: path.join(__dirname, '..') },
  async rewrites() {
    if (process.env.VERCEL === '1' || process.env.CUADRA_EMBEDDED_API === '1') return [];
    return {
      beforeFiles: [{ source: '/api/:path*', destination: (process.env.API_ORIGIN || 'http://127.0.0.1:4000') + '/api/:path*' }],
    };
  },
});
