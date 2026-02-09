'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  GitBranch,
  Rocket,
  Activity,
  Settings,
  Server,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
  GitPullRequest,
  Bell,
  Users,
  HardDrive,
  Pencil,
  Shield,
  Building2,
  ShieldCheck,
  Puzzle,
  PlayCircle,
  Layers,
  FileText,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useOrganizationStore, isAdmin, UserRole } from '@/store/organization-store';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  adminOnly?: boolean;
}

const topLevelItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
];

const navGroups: { id: string; title: string; items: NavItem[] }[] = [
  {
    id: 'git',
    title: 'Git',
    items: [
      { title: 'Repositories', href: '/repositories', icon: FolderGit2 },
      { title: 'Pull Requests', href: '/pull-requests', icon: GitPullRequest },
      { title: 'GitHub Actions', href: '/github-actions', icon: PlayCircle },
      { title: 'GitOps Studio', href: '/gitops-studio', icon: Pencil, adminOnly: true },
    ],
  },
  {
    id: 'monitoring',
    title: 'Monitoring',
    items: [
      { title: 'Monitoring', href: '/monitoring', icon: Activity },
      { title: 'ArgoCD', href: '/argocd', icon: GitBranch },
      { title: 'Clusters', href: '/clusters', icon: Server },
      { title: 'Deployments', href: '/deployments', icon: Rocket },
      { title: 'Uptime Kuma', href: '/uptime-kuma', icon: Activity },
    ],
  },
  {
    id: 'logging',
    title: 'Logging',
    items: [
      { title: 'Alerts', href: '/alerts', icon: Bell, badge: '3' },
      { title: 'Vulnerability', href: '/vulnerability', icon: ShieldCheck },
    ],
  },
  {
    id: 'log-browser',
    title: 'Log-Browser',
    items: [{ title: 'Log Browser', href: '/storage', icon: HardDrive }],
  },
  {
    id: 'tools',
    title: 'Tools',
    items: [
      { title: 'Helm', href: '/helm', icon: Layers },
      { title: 'Diagrams', href: '/diagrams', icon: FileText },
      { title: 'MCP', href: '/mcp', icon: Puzzle },
      { title: 'API Docs', href: '/api-docs', icon: FileText },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    items: [
      { title: 'Organizations', href: '/organizations', icon: Building2 },
      { title: 'Team', href: '/team', icon: Users },
      { title: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);
  const setOrganization = useOrganizationStore((state) => state.setOrganization);
  const userIsAdmin = isAdmin(currentOrganization?.role);

  // Always ensure role is loaded -- fetch from API if the store is missing role data.
  // Cannot rely on cookie because middleware sets it httpOnly (invisible to JS).
  useEffect(() => {
    // Already have a role -- nothing to do
    if (currentOrganization?.role) return;

    let cancelled = false;
    async function refreshOrgData() {
      try {
        const response = await fetch('/api/organizations');
        const result = await response.json();
        if (cancelled || !response.ok || !result.data?.length) return;

        // Prefer matching the stored org id, otherwise take the first
        const targetId = currentOrganization?.id;
        const org = targetId
          ? result.data.find((o: { id: string }) => o.id === targetId) || result.data[0]
          : result.data[0];

        if (org) {
          setOrganization({
            id: org.id,
            name: org.name,
            slug: org.slug,
            role: org.role as UserRole,
          });
        }
      } catch {
        // Silently fail - sidebar will still render, just without admin items
      }
    }
    refreshOrgData();
    return () => { cancelled = true; };
  }, [currentOrganization?.id, currentOrganization?.role, setOrganization]);

  // Filter nav items based on admin status
  const filteredGroups = useMemo(() => {
    return navGroups.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || userIsAdmin),
    }));
  }, [userIsAdmin]);

  const renderNavLink = (item: NavItem, isCollapsed: boolean) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const link = (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-rl-navy/10 text-rl-navy dark:bg-rl-blue/20 dark:text-rl-blue'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {!isCollapsed && (
          <>
            <span className="flex-1">{item.title}</span>
            {item.adminOnly && <Shield className="h-3.5 w-3.5 text-amber-500" />}
            {item.badge && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rl-orange px-1.5 text-xs font-medium text-white">
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {item.title}
            {item.badge && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rl-orange px-1.5 text-xs font-medium text-white">
                {item.badge}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col border-r bg-card transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-rl">
              <span className="text-lg font-bold text-white">R</span>
            </div>
            {!collapsed && (
              <span className="text-lg font-semibold text-rl-navy dark:text-white">
                DevOps Portal
              </span>
            )}
          </Link>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {/* Top-level items (Dashboard) */}
          <div className="space-y-1 mb-2">
            {topLevelItems.map((item) => renderNavLink(item, collapsed))}
          </div>

          {collapsed ? (
            filteredGroups.flatMap((group) => group.items).map((item) => renderNavLink(item, true))
          ) : (
            <Accordion type="multiple" defaultValue={filteredGroups.map((group) => group.id)}>
              {filteredGroups.map((group) => (
                <AccordionItem key={group.id} value={group.id} className="border-b-0">
                  <AccordionTrigger className="rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline">
                    {group.title}
                  </AccordionTrigger>
                  <AccordionContent className="pt-1">
                    <div className="space-y-1">
                      {group.items.map((item) => renderNavLink(item, false))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </nav>

        {/* Collapse Button */}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full justify-center"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
