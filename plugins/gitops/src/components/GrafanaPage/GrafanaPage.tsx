import React from 'react';
import { Page, Header, Content } from '@backstage/core-components';
import { GrafanaDashboards } from '../GrafanaDashboards';

export const GrafanaPage = () => {
  return (
    <Page themeId="tool">
      <Header
        title="Grafana Cloud Dashboards"
        subtitle="Monitor system metrics, performance, and health"
      />
      <Content>
        <GrafanaDashboards />
      </Content>
    </Page>
  );
};
