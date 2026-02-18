'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, GitBranch, Server, Rocket, Pencil } from 'lucide-react';

const cards = [
  {
    title: 'ArgoCD',
    description: 'View apps, sync status, history, resources, and events.',
    href: '/argocd',
    icon: GitBranch,
  },
  {
    title: 'Clusters',
    description: 'Browse namespaces, pods, services, workloads, and logs.',
    href: '/clusters',
    icon: Server,
  },
  {
    title: 'Deployments',
    description: 'Deployment workflows and rollout status (GitOps-driven).',
    href: '/deployments',
    icon: Rocket,
  },
  {
    title: 'GitOps Studio',
    description: 'Edit manifests and push changes (admin only).',
    href: '/gitops-studio',
    icon: Pencil,
  },
];

export default function GitopsLandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gitops</h1>
        <p className="text-muted-foreground">
          Manage deployments via Git-backed workflows: ArgoCD, clusters, deployments, and GitOps Studio.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.href} className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <c.icon className="h-5 w-5" />
                {c.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{c.description}</p>
              <Button asChild className="w-full">
                <Link href={c.href}>
                  Open <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

