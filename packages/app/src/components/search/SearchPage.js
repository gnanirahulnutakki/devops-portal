import React from 'react';
import { SearchType } from '@backstage/plugin-search';
import { DefaultResultListItem, SearchBar, SearchResult, } from '@backstage/plugin-search-react';
import { Content, Header, Page } from '@backstage/core-components';
import { Grid } from '@material-ui/core';
export const searchPage = (React.createElement(Page, { themeId: "home" },
    React.createElement(Header, { title: "Search" }),
    React.createElement(Content, null,
        React.createElement(Grid, { container: true, direction: "row" },
            React.createElement(Grid, { item: true, xs: 12 },
                React.createElement(SearchBar, null)),
            React.createElement(Grid, { item: true, xs: 3 },
                React.createElement(SearchType.Accordion, { name: "Result Type", defaultValue: "software-catalog", types: [
                        {
                            value: 'software-catalog',
                            name: 'Software Catalog',
                        },
                        {
                            value: 'techdocs',
                            name: 'Documentation',
                        },
                    ] })),
            React.createElement(Grid, { item: true, xs: 9 },
                React.createElement(SearchResult, null,
                    React.createElement(DefaultResultListItem, null)))))));
//# sourceMappingURL=SearchPage.js.map