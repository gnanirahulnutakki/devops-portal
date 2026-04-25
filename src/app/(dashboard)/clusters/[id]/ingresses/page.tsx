'use client';

import { use } from 'react';
import { ClusterResourceTable } from '@/components/dashboard/cluster-resource-table';
import { Badge } from '@/components/ui/badge';

interface IngressItem {
  name: string;
  namespace: string;
  hosts?: string[];
  className?: string;
  address?: string;
}

export default function IngressesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ClusterResourceTable<IngressItem>
      clusterId={id}
      resource="ingresses"
      title="Ingresses"
      columns={[
        { key: 'name', label: 'Name', render: (i) => <span className="font-medium">{i.name}</span> },
        { key: 'namespace', label: 'Namespace', render: (i) => <Badge variant="secondary">{i.namespace}</Badge> },
        { key: 'hosts', label: 'Hosts', render: (i) => i.hosts?.join(', ') || '—' },
        { key: 'className', label: 'Class', render: (i) => i.className || '—' },
        { key: 'address', label: 'Address', render: (i) => i.address || '—' },
      ]}
      filterFn={(i, q) =>
        i.name.toLowerCase().includes(q) ||
        i.namespace.toLowerCase().includes(q) ||
        (i.hosts || []).some((h) => h.toLowerCase().includes(q))
      }
      emptyMessage="No ingresses"
    />
  );
}
