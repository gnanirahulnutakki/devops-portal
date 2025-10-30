import { ScmIntegrationsApi, scmIntegrationsApiRef, ScmAuth, } from '@backstage/integration-react';
import { configApiRef, createApiFactory, discoveryApiRef, fetchApiRef, } from '@backstage/core-plugin-api';
import { GitOpsApi, gitOpsApiRef } from '@internal/plugin-gitops';
export const apis = [
    createApiFactory({
        api: scmIntegrationsApiRef,
        deps: { configApi: configApiRef },
        factory: ({ configApi }) => ScmIntegrationsApi.fromConfig(configApi),
    }),
    ScmAuth.createDefaultApiFactory(),
    createApiFactory({
        api: gitOpsApiRef,
        deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
        factory: ({ discoveryApi, fetchApi }) => new GitOpsApi({ discoveryApi, fetchApi }),
    }),
];
//# sourceMappingURL=apis.js.map