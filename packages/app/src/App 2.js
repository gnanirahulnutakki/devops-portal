import React from 'react';
import { Navigate, Route } from 'react-router-dom';
import { apiDocsPlugin, ApiExplorerPage } from '@backstage/plugin-api-docs';
import { CatalogEntityPage, CatalogIndexPage, catalogPlugin, } from '@backstage/plugin-catalog';
import { CatalogImportPage, catalogImportPlugin, } from '@backstage/plugin-catalog-import';
import { ScaffolderPage, scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { orgPlugin } from '@backstage/plugin-org';
import { SearchPage } from '@backstage/plugin-search';
import { TechRadarPage } from '@backstage/plugin-tech-radar';
import { TechDocsIndexPage, techdocsPlugin, TechDocsReaderPage, } from '@backstage/plugin-techdocs';
import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';
import { UserSettingsPage } from '@backstage/plugin-user-settings';
import { apis } from './apis';
import { entityPage } from './components/catalog/EntityPage';
import { searchPage } from './components/search/SearchPage';
import { Root } from './components/Root';
import { AlertDisplay, OAuthRequestDialog } from '@backstage/core-components';
import { createApp } from '@backstage/app-defaults';
import { AppRouter, FlatRoutes } from '@backstage/core-app-api';
import { CatalogGraphPage } from '@backstage/plugin-catalog-graph';
import { RequirePermission } from '@backstage/plugin-permission-react';
import { catalogEntityCreatePermission } from '@backstage/plugin-catalog-common/alpha';
// Import GitOps plugin
import { GitOpsPage } from '@internal/plugin-gitops';
const app = createApp({
    apis,
    bindRoutes({ bind }) {
        bind(catalogPlugin.externalRoutes, {
            createComponent: scaffolderPlugin.routes.root,
            viewTechDoc: techdocsPlugin.routes.docRoot,
        });
        bind(apiDocsPlugin.externalRoutes, {
            registerApi: catalogImportPlugin.routes.importPage,
        });
        bind(scaffolderPlugin.externalRoutes, {
            registerComponent: catalogImportPlugin.routes.importPage,
        });
        bind(orgPlugin.externalRoutes, {
            catalogIndex: catalogPlugin.routes.catalogIndex,
        });
    },
});
const routes = (React.createElement(FlatRoutes, null,
    React.createElement(Route, { path: "/", element: React.createElement(Navigate, { to: "catalog" }) }),
    React.createElement(Route, { path: "/catalog", element: React.createElement(CatalogIndexPage, null) }),
    React.createElement(Route, { path: "/catalog/:namespace/:kind/:name", element: React.createElement(CatalogEntityPage, null) }, entityPage),
    React.createElement(Route, { path: "/docs", element: React.createElement(TechDocsIndexPage, null) }),
    React.createElement(Route, { path: "/docs/:namespace/:kind/:name/*", element: React.createElement(TechDocsReaderPage, null) },
        React.createElement(TechDocsAddons, null,
            React.createElement(ReportIssue, null))),
    React.createElement(Route, { path: "/create", element: React.createElement(ScaffolderPage, null) }),
    React.createElement(Route, { path: "/api-docs", element: React.createElement(ApiExplorerPage, null) }),
    React.createElement(Route, { path: "/tech-radar", element: React.createElement(TechRadarPage, { width: 1500, height: 800 }) }),
    React.createElement(Route, { path: "/catalog-import", element: React.createElement(RequirePermission, { permission: catalogEntityCreatePermission },
            React.createElement(CatalogImportPage, null)) }),
    React.createElement(Route, { path: "/search", element: React.createElement(SearchPage, null) }, searchPage),
    React.createElement(Route, { path: "/settings", element: React.createElement(UserSettingsPage, null) }),
    React.createElement(Route, { path: "/catalog-graph", element: React.createElement(CatalogGraphPage, null) }),
    React.createElement(Route, { path: "/gitops", element: React.createElement(GitOpsPage, null) })));
export default app.createRoot(React.createElement(React.Fragment, null,
    React.createElement(AlertDisplay, null),
    React.createElement(OAuthRequestDialog, null),
    React.createElement(AppRouter, null,
        React.createElement(Root, null, routes))));
//# sourceMappingURL=App%202.js.map