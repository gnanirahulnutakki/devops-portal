import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// App backend (required for serving the frontend)
backend.add(import('@backstage/plugin-app-backend'));

// Auth backend with GitHub provider only
backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));
// Note: Add other providers when their OAuth credentials are configured
// backend.add(import('@backstage/plugin-auth-backend-module-google-provider'));
// backend.add(import('@backstage/plugin-auth-backend-module-microsoft-provider'));
// backend.add(import('@backstage/plugin-auth-backend-module-gitlab-provider'));
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));

// Catalog backend - core feature for service catalog
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(import('@backstage/plugin-catalog-backend-module-github'));
backend.add(import('@backstage/plugin-catalog-backend-module-github-org'));

// Scaffolder (software templates)
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));

// Proxy backend for external services
backend.add(import('@backstage/plugin-proxy-backend'));

// Search backend
backend.add(import('@backstage/plugin-search-backend'));
backend.add(import('@backstage/plugin-search-backend-module-catalog'));

// TechDocs backend
backend.add(import('@backstage/plugin-techdocs-backend'));

// Custom GitOps plugin
backend.add(import('@internal/plugin-gitops-backend'));

backend.start();
