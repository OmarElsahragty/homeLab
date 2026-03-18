import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Robots-Tag', value: 'index, follow' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://static.cloudflareinsights.com",
      "frame-ancestors 'self'",
    ].join('; '),
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  compress: true,

  sassOptions: {
    silenceDeprecations: ['legacy-js-api'],
    // Auto-inject variables & mixins into every *.module.scss file so
    // components can use $text-sm, @include md { }, etc. without manual @use.
    additionalData: `@use "@/styles/variables" as *; @use "@/styles/mixins" as *;`,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  headers: async () => [
    {
      source: '/:path*',
      headers: securityHeaders,
    },
  ],

  poweredByHeader: false,
};

export default nextConfig;
