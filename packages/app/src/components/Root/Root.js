import React from 'react';
import { makeStyles } from '@material-ui/core';
import HomeIcon from '@material-ui/icons/Home';
import ExtensionIcon from '@material-ui/icons/Extension';
import LibraryBooks from '@material-ui/icons/LibraryBooks';
import CreateComponentIcon from '@material-ui/icons/AddCircleOutline';
import GitHubIcon from '@material-ui/icons/GitHub';
import DashboardIcon from '@material-ui/icons/Dashboard';
import CloudIcon from '@material-ui/icons/Cloud';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import LogoFull from './LogoFull';
import LogoIcon from './LogoIcon';
import { Settings as SidebarSettings, UserSettingsSignInAvatar, } from '@backstage/plugin-user-settings';
import { SidebarSearchModal } from '@backstage/plugin-search';
import { Sidebar, sidebarConfig, SidebarDivider, SidebarGroup, SidebarItem, SidebarPage, SidebarScrollWrapper, SidebarSpace, useSidebarOpenState, Link, } from '@backstage/core-components';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
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
    return (React.createElement("div", { className: classes.root },
        React.createElement(Link, { to: "/", underline: "none", className: classes.link, "aria-label": "Home" }, isOpen ? React.createElement(LogoFull, null) : React.createElement(LogoIcon, null))));
};
export const Root = ({ children }) => (React.createElement(SidebarPage, null,
    React.createElement(Sidebar, null,
        React.createElement(SidebarLogo, null),
        React.createElement(SidebarGroup, { label: "Search", icon: React.createElement(SearchIcon, null), to: "/search" },
            React.createElement(SidebarSearchModal, null)),
        React.createElement(SidebarDivider, null),
        React.createElement(SidebarGroup, { label: "Menu", icon: React.createElement(MenuIcon, null) },
            React.createElement(SidebarItem, { icon: HomeIcon, to: "catalog", text: "Home" }),
            React.createElement(SidebarItem, { icon: ExtensionIcon, to: "api-docs", text: "APIs" }),
            React.createElement(SidebarItem, { icon: LibraryBooks, to: "docs", text: "Docs" }),
            React.createElement(SidebarItem, { icon: CreateComponentIcon, to: "create", text: "Create..." }),
            React.createElement(SidebarDivider, null),
            React.createElement(SidebarScrollWrapper, null,
                React.createElement(SidebarItem, { icon: GitHubIcon, to: "gitops", text: "GitOps" }),
                React.createElement(SidebarItem, { icon: DashboardIcon, to: "grafana", text: "Grafana" }),
                React.createElement(SidebarItem, { icon: CloudIcon, to: "s3", text: "S3 Browser" }),
                React.createElement(SidebarItem, { icon: MenuBookIcon, to: "documentation", text: "Documentation" }))),
        React.createElement(SidebarSpace, null),
        React.createElement(SidebarDivider, null),
        React.createElement(SidebarGroup, { label: "Settings", icon: React.createElement(UserSettingsSignInAvatar, null), to: "/settings" },
            React.createElement(SidebarSettings, null))),
    children));
//# sourceMappingURL=Root.js.map