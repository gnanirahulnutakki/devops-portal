import React from 'react';
import { EntityLayout } from '@backstage/plugin-catalog';
import { Grid } from '@material-ui/core';
import { EntityAboutCard, EntityLinksCard, } from '@backstage/plugin-catalog';
export const entityPage = (React.createElement(EntityLayout, null,
    React.createElement(EntityLayout.Route, { path: "/", title: "Overview" },
        React.createElement(Grid, { container: true, spacing: 3, alignItems: "stretch" },
            React.createElement(Grid, { item: true, md: 6 },
                React.createElement(EntityAboutCard, { variant: "gridItem" })),
            React.createElement(Grid, { item: true, md: 6 },
                React.createElement(EntityLinksCard, null))))));
//# sourceMappingURL=EntityPage.js.map