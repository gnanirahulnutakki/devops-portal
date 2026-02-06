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
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Repositories', href: '/repositories', icon: FolderGit2 },
  { title: 'Pull Requests', href: '/pull-requests', icon: GitPullRequest },
  { title: 'Deployments', href: '/deployments', icon: Rocket },
  { title: 'ArgoCD', href: '/argocd', icon: GitBranch },
  { title: 'Monitoring', href: '/monitoring', icon: Activity },
  { title: 'Storage', href: '/storage', icon: HardDrive },
  { title: 'Clusters', href: '/clusters', icon: Server },
  { title: 'Alerts', href: '/alerts', icon: Bell, badge: '3' },
];

const bottomNavItems: NavItem[] = [
  { title: 'Team', href: '/team', icon: Users },
  { title: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            
            const navLink = (
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
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.title}</span>
                    {item.badge && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rl-orange px-1.5 text-xs font-medium text-white">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{navLink}</TooltipTrigger>
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

            return navLink;
          })}
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t p-2">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href;
            
            const navLink = (
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
                {!collapsed && <span>{item.title}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              );
            }

            return navLink;
          })}

          {/* Collapse Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="mt-2 w-full justify-center"
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
