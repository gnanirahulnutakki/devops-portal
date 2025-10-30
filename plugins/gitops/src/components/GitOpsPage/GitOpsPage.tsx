import React from 'react';
import { Page, Header, Content, TabbedLayout } from '@backstage/core-components';
import { RepositoryBrowser } from '../RepositoryBrowser';
import { ArgoCDDashboard } from '../ArgoCDDashboard';
import { OperationsTracker } from '../OperationsTracker';
import { AuditLogViewer } from '../AuditLogViewer';
import { PRManagement } from '../PRManagement';

export const GitOpsPage = () => {
  return (
    <Page themeId="tool">
      <Header
        title="RadiantLogic DevOps Management Portal"
        subtitle="Manage multi-branch configurations and ArgoCD deployments"
      />
      <Content>
        <TabbedLayout>
          <TabbedLayout.Route path="/" title="Repository Browser">
            <RepositoryBrowser />
          </TabbedLayout.Route>

          <TabbedLayout.Route path="/pull-requests" title="Pull Requests">
            <PRManagement />
          </TabbedLayout.Route>

          <TabbedLayout.Route path="/argocd" title="ArgoCD Applications">
            <ArgoCDDashboard />
          </TabbedLayout.Route>

          <TabbedLayout.Route path="/operations" title="Operations">
            <OperationsTracker />
          </TabbedLayout.Route>

          <TabbedLayout.Route path="/audit" title="Audit Logs">
            <AuditLogViewer />
          </TabbedLayout.Route>
        </TabbedLayout>
      </Content>
    </Page>
  );
};
