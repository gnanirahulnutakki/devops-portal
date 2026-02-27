'use client';

import { signOut } from 'next-auth/react';
import { User } from 'next-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useOrganizationStore, type UserRole } from '@/store/organization-store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  Bell,
  Search,
  Moon,
  Sun,
  LogOut,
  User as UserIcon,
  Settings,
  HelpCircle,
  Building2,
  MessageSquare,
  ChevronsUpDown,
  Check,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface HeaderProps {
  user: User & { hasGitHubConnection?: boolean };
}

interface OrgOption {
  id: string;
  name: string;
  slug: string;
  role: UserRole;
}

interface NotificationItem {
  id: string;
  type: 'alert' | 'info' | 'success';
  title: string;
  description: string;
  time: string;
  read: boolean;
}

export function Header({ user }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [commandOpen, setCommandOpen] = useState(false);
  const router = useRouter();

  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const setOrganization = useOrganizationStore((s) => s.setOrganization);

  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    let cancelled = false;
    async function loadOrgs() {
      try {
        const res = await fetch('/api/organizations');
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const list = json.data || json;
        if (res.ok && Array.isArray(list)) {
          setOrgs(
            list.map((o: any) => ({
              id: o.id,
              name: o.name,
              slug: o.slug,
              role: o.role || 'USER',
            }))
          );
        }
      } catch {
        /* ignore */
      }
    }
    void loadOrgs();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'x-organization-id': currentOrganization.id },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.data) {
        setNotifications(json.data);
      }
    } catch {
      /* will show empty */
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const switchOrg = useCallback(
    async (org: OrgOption) => {
      setOrganization({ id: org.id, name: org.name, slug: org.slug, role: org.role });
      setOrgSwitcherOpen(false);
      try {
        await fetch('/api/health', {
          headers: { 'x-organization-id': org.id },
        });
      } catch {
        /* cookie set attempt */
      }
      router.refresh();
    },
    [setOrganization, router]
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const initials =
    user.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || user.email?.[0]?.toUpperCase() || '?';

  const NotifIcon = ({ type }: { type: string }) => {
    if (type === 'alert') return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />;
    if (type === 'success') return <CheckCircle2 className="h-4 w-4 text-rl-green shrink-0" />;
    return <Info className="h-4 w-4 text-rl-blue shrink-0" />;
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      {/* Search */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          className="relative h-9 w-64 justify-start text-sm text-muted-foreground"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="mr-2 h-4 w-4" />
          <span>Search...</span>
          <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* ---- Org Switcher ---- */}
        <Popover open={orgSwitcherOpen} onOpenChange={setOrgSwitcherOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 px-3 max-w-[200px]"
              aria-label="Switch organization"
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate text-sm font-medium">
                {currentOrganization?.name || 'Select org'}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-1" align="end">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-muted-foreground">Organizations</p>
            </div>
            {orgs.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                No organizations
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {orgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => switchOrg(org)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left"
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{org.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                      {org.role}
                    </Badge>
                    {currentOrganization?.id === org.id && (
                      <Check className="h-4 w-4 shrink-0 text-rl-green" />
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="border-t mt-1 pt-1">
              <button
                onClick={() => {
                  setOrgSwitcherOpen(false);
                  router.push('/organizations');
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left text-muted-foreground"
              >
                <Settings className="h-4 w-4" />
                Manage organizations
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* ---- Notifications Bell ---- */}
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rl-orange text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-auto px-2 py-0.5 text-xs" onClick={markAllRead}>
                  Mark all read
                </Button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                  <p className="text-xs text-muted-foreground">
                    Configure Grafana or ArgoCD alerts to see them here.
                  </p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/50 ${
                      n.read ? 'opacity-60' : ''
                    }`}
                  >
                    <NotifIcon type={n.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>
                    </div>
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rl-blue" />
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="border-t px-4 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setNotifOpen(false);
                  router.push('/alerts');
                }}
              >
                View all alerts
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Assistant Popout */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            window.open(
              '/assistant',
              'devops-portal-assistant',
              'width=420,height=640,resizable=yes,scrollbars=yes'
            )
          }
        >
          <MessageSquare className="h-5 w-5" />
          <span className="sr-only">Open assistant</span>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.image || undefined} alt={user.name || ''} />
                <AvatarFallback className="bg-rl-navy text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <UserIcon className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/guides')}>
              <HelpCircle className="mr-2 h-4 w-4" />
              Guides
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Command Palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => { setCommandOpen(false); router.push('/'); }}>
              Dashboard
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); router.push('/monitoring/grafana/dashboards'); }}>
              Grafana Dashboards
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); router.push('/monitoring/grafana/alerts'); }}>
              Grafana Alerts
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); router.push('/argocd'); }}>
              ArgoCD
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); router.push('/clusters'); }}>
              Clusters
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); router.push('/settings/configurations'); }}>
              Configurations
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); router.push('/guides'); }}>
              Guides
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => { setCommandOpen(false); router.push('/settings/configurations/grafana'); }}>
              Add Grafana Account
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); router.push('/settings/configurations/argocd'); }}>
              Add ArgoCD Account
            </CommandItem>
            {/* Vulnerability scanning disabled via feature flag */}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}
