import React from 'react';
import { Page, Header, Content } from '@backstage/core-components';
import { Documentation } from '../Documentation';

export const DocumentationPage = () => {
  return (
    <Page themeId="tool">
      <Header
        title="GitOps Portal Documentation"
        subtitle="Complete guides, references, and troubleshooting for the DevOps Management Portal"
      />
      <Content>
        <Documentation />
      </Content>
    </Page>
  );
};
