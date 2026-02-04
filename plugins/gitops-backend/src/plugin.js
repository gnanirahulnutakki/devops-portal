import { coreServices, createBackendPlugin, } from '@backstage/backend-plugin-api';
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
            async init({ httpRouter, logger, config, database, }) {
                httpRouter.use(await createRouter({
                    logger,
                    config,
                    database,
                }));
                // Auth policy: allow unauthenticated in dev unless explicitly disabled
                const allowUnauthenticated = config.getOptionalBoolean('gitops.auth.allowUnauthenticated') ??
                    process.env.NODE_ENV !== 'production';
                httpRouter.addAuthPolicy({
                    path: '/',
                    allow: allowUnauthenticated ? 'unauthenticated' : 'authenticated',
                });
                logger.info(`GitOps auth policy: ${allowUnauthenticated ? 'unauthenticated' : 'authenticated'}`);
            },
        });
    },
});
//# sourceMappingURL=plugin.js.map