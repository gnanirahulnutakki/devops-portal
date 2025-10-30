import React from 'react';
import { Page, Header, Content, TabbedLayout } from '@backstage/core-components';
import { RepositoryBrowser } from '../RepositoryBrowser';
import { ArgoCDDashboard } from '../ArgoCDDashboard';
import { OperationsTracker } from '../OperationsTracker';
import { AuditLogViewer } from '../AuditLogViewer';
import { PRManagement } from '../PRManagement';
export const GitOpsPage = () => {
    return (React.createElement(Page, { themeId: "tool" },
        React.createElement(Header, { title: "GitOps Management Portal", subtitle: "Manage multi-branch configurations and ArgoCD deployments" }),
        React.createElement(Content, null,
            React.createElement(TabbedLayout, null,
                React.createElement(TabbedLayout.Route, { path: "/", title: "Repository Browser" },
                    React.createElement(RepositoryBrowser, null)),
                React.createElement(TabbedLayout.Route, { path: "/pull-requests", title: "Pull Requests" },
                    React.createElement(PRManagement, null)),
                React.createElement(TabbedLayout.Route, { path: "/argocd", title: "ArgoCD Applications" },
                    React.createElement(ArgoCDDashboard, null)),
                React.createElement(TabbedLayout.Route, { path: "/operations", title: "Operations" },
                    React.createElement(OperationsTracker, null)),
                React.createElement(TabbedLayout.Route, { path: "/audit", title: "Audit Logs" },
                    React.createElement(AuditLogViewer, null))))));
};
//# sourceMappingURL=GitOpsPage.js.map