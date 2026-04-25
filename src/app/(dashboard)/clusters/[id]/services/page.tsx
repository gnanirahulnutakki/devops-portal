'use client';

import { use } from 'react';
import { ClusterResourceTable } from '@/components/dashboard/cluster-resource-table';
import { Badge } from '@/components/ui/badge';

interface ServiceItem {
  name: string;
  namespace: string;
  type?: string;
  clusterIP?: string;
  externalIP?: string;
  ports?: string;
  age?: string;
}

export default function ServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ClusterResourceTable<ServiceItem>
      clusterId={id}
      resource="services"
      title="Services"
      columns={[
        { key: 'name', label: 'Name', render: (s) => <span className="font-medium">{s.name}</span> },
        { key: 'namespace', label: 'Namespace', render: (s) => <Badge variant="secondary">{s.namespace}</Badge> },
        { key: 'type', label: 'Type', render: (s) => s.type || '—' },
        { key: 'clusterIP', label: 'Cluster IP', render: (s) => s.clusterIP || '—' },
        { key: 'externalIP', label: 'External IP', render: (s) => s.externalIP || '—' },
        { key: 'ports', label: 'Ports', render: (s) => s.ports || '—' },
      ]}
      filterFn={(s, q) =>
        s.name.toLowerCase().includes(q) ||
        s.namespace.toLowerCase().includes(q)
      }
      emptyMessage="No services"
    />
  );
}
