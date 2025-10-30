import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';

/**
 * GitOps backend plugin
 *
 * @public
 */
export const gitopsPlugin = createBackendPlugin({
  pluginId: 'gitops',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        database: coreServices.database,
      },
      async init({
        httpRouter,
        logger,
        config,
        database,
      }) {
        httpRouter.use(
          await createRouter({
            logger,
            config,
            database,
          }),
        );

        // Allow unauthenticated access for Phase 0 development
        // TODO: Add proper authentication in Phase 2
        httpRouter.addAuthPolicy({
          path: '/',
          allow: 'unauthenticated',
        });
      },
    });
  },
});
