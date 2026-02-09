import React, { PropsWithChildren } from 'react';
import { makeStyles } from '@material-ui/core';
import HomeIcon from '@material-ui/icons/Home';
import ExtensionIcon from '@material-ui/icons/Extension';
import MapIcon from '@material-ui/icons/MyLocation';
import LibraryBooks from '@material-ui/icons/LibraryBooks';
import CreateComponentIcon from '@material-ui/icons/AddCircleOutline';
import GitHubIcon from '@material-ui/icons/GitHub';
import DashboardIcon from '@material-ui/icons/Dashboard';
import CloudIcon from '@material-ui/icons/Cloud';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import VisibilityIcon from '@material-ui/icons/Visibility';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import StorageIcon from '@material-ui/icons/Storage';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import LogoFull from './LogoFull';
import LogoIcon from './LogoIcon';
import {
  Settings as SidebarSettings,
  UserSettingsSignInAvatar,
} from '@backstage/plugin-user-settings';
import { SidebarSearchModal } from '@backstage/plugin-search';
import {
  Sidebar,
  sidebarConfig,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarPage,
  SidebarScrollWrapper,
  SidebarSpace,
  useSidebarOpenState,
  Link,
} from '@backstage/core-components';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';

// Logout component
const LogoutButton = () => {
  const identityApi = useApi(identityApiRef);
  
  const handleLogout = async () => {
    // Clear local storage
    localStorage.removeItem('devops-portal-token');
    localStorage.removeItem('devops-portal-refresh-token');
    localStorage.removeItem('devops-portal-guest-token');
    
    // Sign out via Backstage API
    try {
      await identityApi.signOut?.();
    } catch (e) {
      // Ignore errors, just redirect
    }
    
    // Redirect to sign-in
    window.location.href = '/';
  };

  return (
    <SidebarItem
      icon={ExitToAppIcon}
      text="Sign Out"
      onClick={handleLogout}
    />
  );
};

const useSidebarLogoStyles = makeStyles({
  root: {
    width: sidebarConfig.drawerWidthClosed,
    height: 3 * sidebarConfig.logoHeight,
    display: 'flex',
    flexFlow: 'row nowrap',
    alignItems: 'center',
    marginBottom: -14,
  },
  link: {
    width: sidebarConfig.drawerWidthClosed,
    marginLeft: 24,
  },
});

const SidebarLogo = () => {
  const classes = useSidebarLogoStyles();
  const { isOpen } = useSidebarOpenState();

  return (
    <div className={classes.root}>
      <Link to="/" underline="none" className={classes.link} aria-label="Home">
        {isOpen ? <LogoFull /> : <LogoIcon />}
      </Link>
    </div>
  );
};

export const Root = ({ children }: PropsWithChildren<{}>) => (
  <SidebarPage>
    <Sidebar>
      <SidebarLogo />
      <SidebarGroup label="Search" icon={<SearchIcon />} to="/search">
        <SidebarSearchModal />
      </SidebarGroup>
      <SidebarDivider />
      <SidebarGroup label="Menu" icon={<MenuIcon />}>
        {/* Home Dashboard */}
        <SidebarItem icon={HomeIcon} to="/" text="Home" />
        <SidebarItem icon={ExtensionIcon} to="api-docs" text="APIs" />
        <SidebarItem icon={LibraryBooks} to="docs" text="Docs" />
        <SidebarItem icon={CreateComponentIcon} to="create" text="Create..." />
        <SidebarDivider />
        <SidebarScrollWrapper>
          {/* GitOps Management Portal */}
          <SidebarItem icon={GitHubIcon} to="gitops" text="GitOps" />

          {/* Grafana Cloud Dashboards */}
          <SidebarItem icon={DashboardIcon} to="grafana" text="Grafana" />

          {/* Unified Monitoring Dashboard */}
          <SidebarItem icon={VisibilityIcon} to="monitoring" text="Monitoring" />

          {/* GitHub Actions CI/CD */}
          <SidebarItem icon={PlayArrowIcon} to="github-actions" text="CI/CD" />

          {/* S3 File Browser */}
          <SidebarItem icon={CloudIcon} to="s3" text="S3 Browser" />

          {/* Service Catalog */}
          <SidebarItem icon={StorageIcon} to="catalog" text="Catalog" />

          {/* GitOps Documentation */}
          <SidebarItem icon={MenuBookIcon} to="documentation" text="Documentation" />
        </SidebarScrollWrapper>
      </SidebarGroup>
      <SidebarSpace />
      <SidebarDivider />
      <SidebarGroup
        label="Settings"
        icon={<UserSettingsSignInAvatar />}
        to="/settings"
      >
        <SidebarSettings />
        <SidebarDivider />
        <LogoutButton />
      </SidebarGroup>
    </Sidebar>
    {children}
  </SidebarPage>
);
