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
// Custom GitOps plugin
backend.add(import('@internal/plugin-gitops-backend'));
backend.start();
//# sourceMappingURL=index.js.map