'use client';

import { use, useEffect, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { ClusterSidebar } from '@/components/dashboard/cluster-sidebar';

interface ClusterMeta {
  id: string;
  name: string;
  provider?: string;
  region?: string;
  environment?: string;
  status?: string;
}

export default function ClusterDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);
  const [cluster, setCluster] = useState<ClusterMeta | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/clusters', {
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json();
      if (cancelled) return;
      const list: ClusterMeta[] = data.data || [];
      const found = list.find((c) => c.id === id) || null;
      setCluster(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, id]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] -m-6">
      <ClusterSidebar
        clusterId={id}
        clusterName={cluster?.name}
        status={cluster ? `${cluster.provider || ''} ${cluster.environment || ''} ${cluster.status || ''}`.trim() : undefined}
      />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
