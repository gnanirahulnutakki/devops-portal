import {
  ScmIntegrationsApi,
  scmIntegrationsApiRef,
  ScmAuth,
} from '@backstage/integration-react';
import {
  AnyApiFactory,
  configApiRef,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
  githubAuthApiRef,
} from '@backstage/core-plugin-api';
import { GitOpsApi, gitOpsApiRef } from '@internal/plugin-gitops';

export const apis: AnyApiFactory[] = [
  createApiFactory({
    api: scmIntegrationsApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => ScmIntegrationsApi.fromConfig(configApi),
  }),
  ScmAuth.createDefaultApiFactory(),
  // GitOps API with GitHub OAuth token support
  // The user's GitHub OAuth token is used for API calls when available,
  // enabling user-scoped access to repositories based on their permissions.
  createApiFactory({
    api: gitOpsApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      fetchApi: fetchApiRef,
      githubAuthApi: githubAuthApiRef,
    },
    factory: ({ discoveryApi, fetchApi, githubAuthApi }) =>
      new GitOpsApi({ discoveryApi, fetchApi, githubAuthApi }),
  }),
];
