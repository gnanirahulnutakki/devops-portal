'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Server, Layers, Box, Network } from 'lucide-react';

interface Overview {
  nodeCount?: number;
  namespaceCount?: number;
  podCount?: number;
  workloadCount?: number;
  serverVersion?: string;
}

export default function ClusterOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clusters/${id}/overview`, {
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json();
      if (res.ok) setOverview(data.data);
    } finally {
      setLoading(false);
    }
  }, [orgId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        {overview?.serverVersion && (
          <p className="text-sm text-muted-foreground">Kubernetes {overview.serverVersion}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Server} label="Nodes" value={overview?.nodeCount} />
        <Stat icon={Layers} label="Namespaces" value={overview?.namespaceCount} />
        <Stat icon={Box} label="Pods" value={overview?.podCount} />
        <Stat icon={Network} label="Workloads" value={overview?.workloadCount} />
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Server; label: string; value?: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value ?? '—'}</div>
      </CardContent>
    </Card>
  );
}
