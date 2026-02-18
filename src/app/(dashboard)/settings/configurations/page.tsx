'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, GitBranch, Github, Gauge, Activity, Brain, Database } from 'lucide-react';

const tiles = [
  {
    title: 'Grafana',
    description: 'Accounts for dashboards, alerts, and Loki Explore.',
    href: '/settings/configurations/grafana',
    icon: Gauge,
  },
  {
    title: 'ArgoCD',
    description: 'Manage ArgoCD endpoints and tokens.',
    href: '/settings/configurations/argocd',
    icon: GitBranch,
  },
  {
    title: 'GitHub',
    description: 'Manage GitHub tokens and org defaults.',
    href: '/settings/configurations/github',
    icon: Github,
  },
  {
    title: 'Uptime Kuma',
    description: 'Manage Uptime Kuma endpoints and API keys.',
    href: '/settings/configurations/uptime-kuma',
    icon: Activity,
  },
  {
    title: 'LLM',
    description: 'Manage LLM providers, keys, and models.',
    href: '/settings/configurations/llm',
    icon: Brain,
  },
  {
    title: 'Supabase',
    description: 'Manage Supabase endpoints and keys.',
    href: '/settings/configurations/supabase',
    icon: Database,
  },
];

export default function ConfigurationsLandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurations</h1>
        <p className="text-muted-foreground">
          Add, edit, enable/disable, and delete integration accounts. This portal is meant to be CRUD-friendly.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.href} className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <t.icon className="h-5 w-5" />
                {t.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{t.description}</p>
              <Button asChild>
                <Link href={t.href}>
                  Manage <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

