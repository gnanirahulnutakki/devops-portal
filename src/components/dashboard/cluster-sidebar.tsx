'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Server, Layers, Box, Network, Globe,
  Bell, Package, Boxes,
} from 'lucide-react';

interface ClusterSidebarProps {
  clusterId: string;
  clusterName?: string;
  status?: string;
}

const NAV: { href: string; label: string; icon: typeof Server }[] = [
  { href: '', label: 'Overview', icon: LayoutDashboard },
  { href: '/nodes', label: 'Nodes', icon: Server },
  { href: '/workloads', label: 'Workloads', icon: Layers },
  { href: '/pods', label: 'Pods', icon: Box },
  { href: '/services', label: 'Services', icon: Network },
  { href: '/ingresses', label: 'Ingresses', icon: Globe },
  { href: '/events', label: 'Events', icon: Bell },
  { href: '/helm', label: 'Helm', icon: Package },
  { href: '/crds', label: 'CRDs', icon: Boxes },
];

export function ClusterSidebar({ clusterId, clusterName, status }: ClusterSidebarProps) {
  const pathname = usePathname();
  const base = `/clusters/${clusterId}`;

  return (
    <aside className="w-56 border-r bg-muted/30 px-3 py-4 space-y-4">
      <div className="px-2">
        <Link href="/clusters" className="text-xs text-muted-foreground hover:text-foreground">
          ← All clusters
        </Link>
        <h2 className="font-semibold mt-2 truncate" title={clusterName}>
          {clusterName || clusterId.slice(0, 8)}
        </h2>
        {status && (
          <p className="text-xs text-muted-foreground">{status}</p>
        )}
      </div>
      <nav className="space-y-0.5">
        {NAV.map((item) => {
          const href = `${base}${item.href}`;
          const active = pathname === href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={href}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                active
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'hover:bg-accent/50 text-muted-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
