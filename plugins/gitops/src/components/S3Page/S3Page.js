import React from 'react';
import { Page, Header, Content } from '@backstage/core-components';
import { S3FileBrowser } from '../S3FileBrowser';
export const S3Page = () => {
    return (React.createElement(Page, { themeId: "tool" },
        React.createElement(Header, { title: "S3 File Browser", subtitle: "Browse and download files from AWS S3 buckets" }),
        React.createElement(Content, null,
            React.createElement(S3FileBrowser, null))));
};
//# sourceMappingURL=S3Page.js.map