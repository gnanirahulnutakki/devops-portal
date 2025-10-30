import React from 'react';
import { EntityLayout } from '@backstage/plugin-catalog';
import { Grid } from '@material-ui/core';
import {
  EntityAboutCard,
  EntityLinksCard,
} from '@backstage/plugin-catalog';

export const entityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        <Grid item md={6}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6}>
          <EntityLinksCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);
