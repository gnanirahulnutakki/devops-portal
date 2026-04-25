'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Gauge,
  GitBranch,
  Shield,
  Key,
  Users,
  Plug,
  BookOpen,
  Layers,
  Bell,
  Logs,
  Server,
  Settings,
} from 'lucide-react';
import Link from 'next/link';

const guides = [
  {
    category: 'Getting Started',
    items: [
      {
        title: 'First-time Setup',
        description:
          'Create your organization, add your first user, and configure basic settings.',
        href: '/settings',
        icon: Settings,
        badge: 'Start here',
      },
      {
        title: 'Add Integrations',
        description:
          'Connect Grafana, ArgoCD, GitHub, and other tools via Settings > Configurations.',
        href: '/settings/configurations',
        icon: Plug,
      },
    ],
  },
  {
    category: 'Monitoring',
    items: [
      {
        title: 'Grafana Dashboards',
        description:
          'Add a Grafana service account, then browse and edit dashboards inside the portal.',
        href: '/monitoring/grafana/dashboards',
        icon: Gauge,
      },
      {
        title: 'Grafana Alerts & Insights',
        description:
          'View alert rules, see noisy alerts, and drill into event timelines.',
        href: '/monitoring/grafana/insights',
        icon: Bell,
      },
      {
        title: 'Loki Logs',
        description:
          'If Loki is configured as a Grafana datasource, query logs from within the portal.',
        href: '/monitoring/loki',
        icon: Logs,
      },
    ],
  },
  {
    category: 'GitOps',
    items: [
      {
        title: 'ArgoCD Integration',
        description:
          'Add your ArgoCD server to view applications, sync status, and deployment history.',
        href: '/argocd',
        icon: GitBranch,
      },
      {
        title: 'Kubernetes Clusters',
        description:
          'Browse namespaces, pods, services, and workloads from connected clusters.',
        href: '/clusters',
        icon: Server,
      },
      {
        title: 'Helm Charts',
        description:
          'Browse and manage Helm releases from the portal.',
        href: '/helm',
        icon: Layers,
      },
    ],
  },
  {
    category: 'Security',
    items: [
      {
        title: 'Vulnerability Scanning',
        description:
          'Run Trivy scans on Docker images, view Trivy Operator reports, and track Dependabot alerts.',
        href: '/vulnerability',
        icon: Shield,
      },
      {
        title: 'Secret Management',
        description:
          'All integration tokens are AES-256-GCM encrypted at rest with key rotation support.',
        href: '/settings/configurations',
        icon: Key,
      },
    ],
  },
  {
    category: 'Administration',
    items: [
      {
        title: 'Organization Management',
        description:
          'Create orgs, invite team members, and assign granular roles (ADMIN / READWRITE / USER).',
        href: '/organizations',
        icon: Users,
      },
      {
        title: 'Feature Flags & RBAC',
        description:
          'Enable or disable portal sections per-user via Helm values or admin UI.',
        href: '/team',
        icon: BookOpen,
      },
    ],
  },
];

export default function GuidesPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Guides</h1>
        <p className="text-muted-foreground">
          Everything you need to set up and use the DevOps Portal effectively.
        </p>
      </div>

      {guides.map((group) => (
        <section key={group.category} className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {group.category}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {group.items.map((g) => (
              <Link key={g.href} href={g.href} className="group">
                <Card className="h-full hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <g.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      {g.title}
                      {g.badge && (
                        <Badge variant="secondary" className="text-[10px]">
                          {g.badge}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {g.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
