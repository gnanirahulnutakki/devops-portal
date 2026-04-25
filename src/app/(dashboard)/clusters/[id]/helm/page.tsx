'use client';

import { use } from 'react';
import { ClusterResourceTable } from '@/components/dashboard/cluster-resource-table';
import { Badge } from '@/components/ui/badge';

interface HelmRelease {
  name: string;
  namespace: string;
  revision?: number;
  status?: string;
  chart?: string;
  appVersion?: string;
  updated?: string;
}

export default function HelmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ClusterResourceTable<HelmRelease>
      clusterId={id}
      resource="helm"
      title="Helm Releases"
      columns={[
        { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
        { key: 'namespace', label: 'Namespace', render: (r) => <Badge variant="secondary">{r.namespace}</Badge> },
        { key: 'chart', label: 'Chart', render: (r) => r.chart || '—' },
        { key: 'revision', label: 'Rev', render: (r) => r.revision ?? '—' },
        { key: 'status', label: 'Status', render: (r) => <Badge variant={r.status === 'deployed' ? 'default' : 'secondary'}>{r.status || '—'}</Badge> },
        { key: 'appVersion', label: 'App Version', render: (r) => r.appVersion || '—' },
        { key: 'updated', label: 'Updated', render: (r) => r.updated || '—' },
      ]}
      filterFn={(r, q) =>
        r.name.toLowerCase().includes(q) ||
        r.namespace.toLowerCase().includes(q) ||
        (r.chart || '').toLowerCase().includes(q)
      }
      emptyMessage="No helm releases"
    />
  );
}
