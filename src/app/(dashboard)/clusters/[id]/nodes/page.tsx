'use client';

import { use } from 'react';
import { ClusterResourceTable } from '@/components/dashboard/cluster-resource-table';
import { Badge } from '@/components/ui/badge';

interface NodeItem {
  name: string;
  status: string;
  roles?: string[];
  version?: string;
  cpu?: string;
  memory?: string;
  pods?: number;
}

export default function NodesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ClusterResourceTable<NodeItem>
      clusterId={id}
      resource="nodes"
      title="Nodes"
      columns={[
        { key: 'name', label: 'Name', render: (n) => <span className="font-medium">{n.name}</span> },
        { key: 'status', label: 'Status', render: (n) => <Badge variant={n.status === 'Ready' ? 'default' : 'destructive'}>{n.status}</Badge> },
        { key: 'roles', label: 'Roles', render: (n) => n.roles?.join(', ') || '—' },
        { key: 'version', label: 'Kubelet', render: (n) => n.version || '—' },
        { key: 'cpu', label: 'CPU', render: (n) => n.cpu || '—' },
        { key: 'memory', label: 'Memory', render: (n) => n.memory || '—' },
        { key: 'pods', label: 'Pods', render: (n) => n.pods ?? '—' },
      ]}
      filterFn={(n, q) => n.name.toLowerCase().includes(q)}
      emptyMessage="No nodes returned by the cluster"
    />
  );
}
