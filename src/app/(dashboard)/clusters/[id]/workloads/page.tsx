'use client';

import { use } from 'react';
import { ClusterResourceTable } from '@/components/dashboard/cluster-resource-table';
import { Badge } from '@/components/ui/badge';

interface WorkloadItem {
  name: string;
  namespace: string;
  type: string;
  ready?: string;
  available?: number;
  desired?: number;
  age?: string;
}

export default function WorkloadsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ClusterResourceTable<WorkloadItem>
      clusterId={id}
      resource="workloads"
      title="Workloads"
      columns={[
        { key: 'name', label: 'Name', render: (w) => <span className="font-medium">{w.name}</span> },
        { key: 'namespace', label: 'Namespace', render: (w) => <Badge variant="secondary">{w.namespace}</Badge> },
        { key: 'type', label: 'Kind', render: (w) => w.type },
        { key: 'ready', label: 'Ready', render: (w) => w.ready ?? `${w.available ?? 0}/${w.desired ?? 0}` },
        { key: 'age', label: 'Age', render: (w) => w.age || '—' },
      ]}
      filterFn={(w, q) =>
        w.name.toLowerCase().includes(q) ||
        w.namespace.toLowerCase().includes(q) ||
        w.type.toLowerCase().includes(q)
      }
      emptyMessage="No workloads"
    />
  );
}
