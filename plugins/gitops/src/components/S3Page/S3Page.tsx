import React from 'react';
import { Page, Header, Content } from '@backstage/core-components';
import { S3FileBrowser } from '../S3FileBrowser';

export const S3Page = () => {
  return (
    <Page themeId="tool">
      <Header
        title="S3 File Browser"
        subtitle="Browse and download files from AWS S3 buckets"
      />
      <Content>
        <S3FileBrowser />
      </Content>
    </Page>
  );
};
