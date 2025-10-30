import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// App backend (required for serving the frontend)
backend.add(import('@backstage/plugin-app-backend/alpha'));

// Auth backend - temporarily disabled due to tokenManager dependency issue
// Will enable once we resolve the service dependency
// backend.add(import('@backstage/plugin-auth-backend'));

// Custom GitOps plugin
backend.add(import('@internal/plugin-gitops-backend'));

backend.start();
