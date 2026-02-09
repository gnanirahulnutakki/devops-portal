import React from 'react';
import { Page, Header, Content } from '@backstage/core-components';
import { GrafanaDashboards } from '../GrafanaDashboards';
export const GrafanaPage = () => {
    return (React.createElement(Page, { themeId: "tool" },
        React.createElement(Header, { title: "Grafana Cloud Dashboards", subtitle: "Monitor system metrics, performance, and health" }),
        React.createElement(Content, null,
            React.createElement(GrafanaDashboards, null))));
};
//# sourceMappingURL=GrafanaPage.js.map