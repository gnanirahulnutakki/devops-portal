import React from 'react';
import { SearchType } from '@backstage/plugin-search';
import {
  DefaultResultListItem,
  SearchBar,
  SearchFilter,
  SearchResult,
} from '@backstage/plugin-search-react';
import { Content, Header, Page } from '@backstage/core-components';
import { Grid } from '@material-ui/core';

export const searchPage = (
  <Page themeId="home">
    <Header title="Search" />
    <Content>
      <Grid container direction="row">
        <Grid item xs={12}>
          <SearchBar />
        </Grid>
        <Grid item xs={3}>
          <SearchType.Accordion
            name="Result Type"
            defaultValue="software-catalog"
            types={[
              {
                value: 'software-catalog',
                name: 'Software Catalog',
              },
              {
                value: 'techdocs',
                name: 'Documentation',
              },
            ]}
          />
        </Grid>
        <Grid item xs={9}>
          <SearchResult>
            <DefaultResultListItem />
          </SearchResult>
        </Grid>
      </Grid>
    </Content>
  </Page>
);
