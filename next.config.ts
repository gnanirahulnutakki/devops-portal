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
    return [
      {
        source: '/(.*)',
        headers: [
          // Allow the portal to iframe its own content (Grafana render previews, etc.)
          // while still blocking external sites from framing it (via CSP frame-ancestors 'self').
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              // connect-src: APIs that can be called from client-side
              `connect-src 'self' https://api.github.com https://*.githubusercontent.com ${process.env.GRAFANA_URL ?? ''} ${process.env.ARGOCD_URL ?? ''}`.trim(),
              // allow embedding external diagram editor
              "frame-src 'self' https://app.diagrams.net https://embed.diagrams.net",
              // Block external framing, but allow same-origin iframes we rely on (render previews)
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
