'use client';

import { use } from 'react';
import { ClusterResourceTable } from '@/components/dashboard/cluster-resource-table';
import { Badge } from '@/components/ui/badge';

interface PodItem {
  name: string;
  namespace: string;
  status: string;
  ready?: string;
  restarts?: number;
  age?: string;
  node?: string;
}

const STATUS_VARIANT = (s: string): 'default' | 'destructive' | 'secondary' => {
  if (s === 'Running' || s === 'Succeeded') return 'default';
  if (s === 'Failed' || s === 'CrashLoopBackOff') return 'destructive';
  return 'secondary';
};

export default function PodsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ClusterResourceTable<PodItem>
      clusterId={id}
      resource="pods"
      title="Pods"
      columns={[
        { key: 'name', label: 'Name', render: (p) => <span className="font-medium">{p.name}</span> },
        { key: 'namespace', label: 'Namespace', render: (p) => <Badge variant="secondary">{p.namespace}</Badge> },
        { key: 'status', label: 'Status', render: (p) => <Badge variant={STATUS_VARIANT(p.status)}>{p.status}</Badge> },
        { key: 'ready', label: 'Ready', render: (p) => p.ready ?? '—' },
        { key: 'restarts', label: 'Restarts', render: (p) => p.restarts ?? 0 },
        { key: 'node', label: 'Node', render: (p) => p.node || '—' },
        { key: 'age', label: 'Age', render: (p) => p.age || '—' },
      ]}
      filterFn={(p, q) =>
        p.name.toLowerCase().includes(q) ||
        p.namespace.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q)
      }
      emptyMessage="No pods"
    />
  );
}
