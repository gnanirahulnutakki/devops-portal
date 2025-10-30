import { createPlugin, createRoutableExtension, } from '@backstage/core-plugin-api';
import { rootRouteRef } from './routes';
export const gitopsPlugin = createPlugin({
    id: 'gitops',
    routes: {
        root: rootRouteRef,
    },
});
export const GitOpsPage = gitopsPlugin.provide(createRoutableExtension({
    name: 'GitOpsPage',
    component: () => import('./components/GitOpsPage').then(m => m.GitOpsPage),
    mountPoint: rootRouteRef,
}));
//# sourceMappingURL=plugin.js.map