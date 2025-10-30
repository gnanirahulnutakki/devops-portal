import { createBackend } from '@backstage/backend-defaults';
const backend = createBackend();
// App backend (required for serving the frontend)
backend.add(import('@backstage/plugin-app-backend/alpha'));
// Auth backend - enables OAuth authentication
backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));
backend.add(import('@backstage/plugin-auth-backend-module-google-provider'));
backend.add(import('@backstage/plugin-auth-backend-module-oauth2-provider')); // Used for Microsoft Azure AD
// Custom GitOps plugin
backend.add(import('@internal/plugin-gitops-backend'));
backend.start();
//# sourceMappingURL=index.js.map