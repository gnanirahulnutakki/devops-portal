import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Fix Next workspace-root inference when multiple lockfiles exist.
  outputFileTracingRoot: path.join(__dirname),
  
  // PPR requires Next.js canary - enable when ready
  // experimental: {
  //   ppr: true,
  // },

  // Security headers
  async headers() {
    const commonSecurityHeaders = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
    ];

    return [
      // Grafana proxy routes: relaxed CSP so the Grafana SPA can load its own
      // assets, workers, and WebSocket connections.  The proxy already strips
      // upstream CSP headers, so we only need a permissive portal-side policy.
      {
        source: '/grafana/:path*',
        headers: [
          ...commonSecurityHeaders,
          // No CSP — let Grafana manage its own content security.
          // Auth is enforced by the proxy route handler (session + org membership).
        ],
      },
      // All other routes: strict CSP for the portal application.
      {
        source: '/((?!grafana/).*)',
        headers: [
          ...commonSecurityHeaders,
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              `connect-src 'self' https://api.github.com https://*.githubusercontent.com https://*.diagrams.net https://*.draw.io ${process.env.GRAFANA_URL ?? ''} ${process.env.ARGOCD_URL ?? ''}`.trim(),
              "frame-src 'self' https://app.diagrams.net https://embed.diagrams.net https://viewer.diagrams.net",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },

  // Images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
    ],
  },

  // Logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  env: {
    GRAFANA_URL: process.env.GRAFANA_URL,
    GRAFANA_API_KEY: process.env.GRAFANA_API_KEY,
  },
};

export default nextConfig;
