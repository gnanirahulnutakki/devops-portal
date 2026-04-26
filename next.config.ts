import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // standalone output is incompatible with our custom WebSocket server
  // (server.ts wraps Next.js + dispatches /api/ws/* upgrades). Standalone
  // does not include arbitrary deps (ws, jose, @kubernetes/client-node) in
  // its bundle. Trade-off: larger image (~500MB vs ~150MB) for working pod-exec.
  outputFileTracingRoot: path.join(__dirname),
  // Don't expose framework in response headers
  poweredByHeader: false,
  
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
      // OpenWebUI proxy routes: relaxed CSP so the OpenWebUI SPA can load its own assets.
      {
        source: '/openwebui/:path*',
        headers: [
          ...commonSecurityHeaders,
          // No CSP — let OpenWebUI manage its own content security.
        ],
      },
      // All other routes: strict CSP for the portal application.
      {
        source: '/((?!grafana/|openwebui/).*)',
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

  // Rewrites — proxy OpenWebUI (ClusterIP) through Next.js
  async rewrites() {
    const openWebUIUrl = process.env.OPENWEBUI_URL || 'http://open-webui:80';
    return [
      {
        source: '/openwebui/:path*',
        destination: `${openWebUIUrl}/:path*`,
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

  // NOTE: Values in `env` are inlined into client JS bundles at build time.
  // NEVER put secrets (API keys, tokens, passwords) here.
  // Server-only env vars should be accessed via process.env in server code only.
  env: {
    OLLAMA_URL: process.env.OLLAMA_URL,
    OPENWEBUI_URL: process.env.OPENWEBUI_URL,
  },
};

export default nextConfig;
