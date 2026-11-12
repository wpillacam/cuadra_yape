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
  async rewrites() {
    return [{ source: '/api/:path*', destination: (process.env.API_ORIGIN || 'http://127.0.0.1:4000') + '/api/:path*' }];
  },
});
