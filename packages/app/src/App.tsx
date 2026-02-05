import React from 'react';
import { Navigate, Route } from 'react-router-dom';
import { apiDocsPlugin, ApiExplorerPage } from '@backstage/plugin-api-docs';
import {
  CatalogEntityPage,
  CatalogIndexPage,
  catalogPlugin,
} from '@backstage/plugin-catalog';
import {
  CatalogImportPage,
  catalogImportPlugin,
} from '@backstage/plugin-catalog-import';
import { ScaffolderPage, scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { orgPlugin } from '@backstage/plugin-org';
import { SearchPage } from '@backstage/plugin-search';
// import { TechRadarPage } from '@backstage/plugin-tech-radar'; // Not included in Phase 0
import {
  TechDocsIndexPage,
  techdocsPlugin,
  TechDocsReaderPage,
} from '@backstage/plugin-techdocs';
import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';
import { UserSettingsPage } from '@backstage/plugin-user-settings';
import { apis } from './apis';
import { entityPage } from './components/catalog/EntityPage';
import { searchPage } from './components/search/SearchPage';
import { Root } from './components/Root';
import { HomePage } from './components/home';

import { AlertDisplay, OAuthRequestDialog } from '@backstage/core-components';
import { createApp } from '@backstage/app-defaults';
import { AppRouter, FlatRoutes } from '@backstage/core-app-api';
import { CatalogGraphPage } from '@backstage/plugin-catalog-graph';
import { RequirePermission } from '@backstage/plugin-permission-react';
import { catalogEntityCreatePermission } from '@backstage/plugin-catalog-common/alpha';
import { UnifiedThemeProvider } from '@backstage/theme';

// Import GitOps plugin
import { GitOpsPage, GrafanaPage, S3Page, DocumentationPage, GitHubActionsPage } from '@internal/plugin-gitops';

// Import custom Radiant Logic themes
import { radiantLogicTheme, radiantLogicDarkTheme } from './theme';

// Import custom SignIn page
import { SignInPage } from './components/auth/SignInPage';

const app = createApp({
  apis,
  themes: [
    {
      id: 'radiant-logic-light',
      title: 'Radiant Logic Light',
      variant: 'light',
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={radiantLogicTheme} children={children} />
      ),
    },
    {
      id: 'radiant-logic-dark',
      title: 'Radiant Logic Dark',
      variant: 'dark',
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={radiantLogicDarkTheme} children={children} />
      ),
    },
  ],
  // OAuth Sign-In Page
  components: {
    SignInPage,
  },
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

const routes = (
  <FlatRoutes>
    <Route path="/" element={<HomePage />} />
    <Route path="/catalog" element={<CatalogIndexPage />} />
    <Route
      path="/catalog/:namespace/:kind/:name"
      element={<CatalogEntityPage />}
    >
      {entityPage}
    </Route>
    <Route path="/docs" element={<TechDocsIndexPage />} />
    <Route
      path="/docs/:namespace/:kind/:name/*"
      element={<TechDocsReaderPage />}
    >
      <TechDocsAddons>
        <ReportIssue />
      </TechDocsAddons>
    </Route>
    <Route path="/create" element={<ScaffolderPage />} />
    <Route path="/api-docs" element={<ApiExplorerPage />} />
    {/* <Route
      path="/tech-radar"
      element={<TechRadarPage width={1500} height={800} />}
    /> */}
    <Route
      path="/catalog-import"
      element={
        <RequirePermission permission={catalogEntityCreatePermission}>
          <CatalogImportPage />
        </RequirePermission>
      }
    />
    <Route path="/search" element={<SearchPage />}>
      {searchPage}
    </Route>
    <Route path="/settings" element={<UserSettingsPage />} />
    <Route path="/catalog-graph" element={<CatalogGraphPage />} />

    {/* GitOps Management Portal */}
    <Route path="/gitops" element={<GitOpsPage />} />

    {/* Grafana Cloud Dashboards */}
    <Route path="/grafana" element={<GrafanaPage />} />

    {/* S3 File Browser */}
    <Route path="/s3" element={<S3Page />} />

    {/* Documentation */}
    <Route path="/documentation" element={<DocumentationPage />} />

    {/* GitHub Actions - CI/CD Monitoring */}
    <Route path="/github-actions" element={<GitHubActionsPage />} />
  </FlatRoutes>
);

export default app.createRoot(
  <>
    <AlertDisplay />
    <OAuthRequestDialog />
    <AppRouter>
      <Root>{routes}</Root>
    </AppRouter>
  </>,
);
