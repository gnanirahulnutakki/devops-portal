'use client';

import { use } from 'react';
import { ClusterResourceTable } from '@/components/dashboard/cluster-resource-table';

interface CrdItem {
  name: string;
  group?: string;
  version?: string;
  scope?: string;
  kind?: string;
}

export default function CrdsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ClusterResourceTable<CrdItem>
      clusterId={id}
      resource="crds"
      title="Custom Resource Definitions"
      columns={[
        { key: 'name', label: 'Name', render: (c) => <span className="font-medium">{c.name}</span> },
        { key: 'group', label: 'Group', render: (c) => c.group || '—' },
        { key: 'version', label: 'Version', render: (c) => c.version || '—' },
        { key: 'kind', label: 'Kind', render: (c) => c.kind || '—' },
        { key: 'scope', label: 'Scope', render: (c) => c.scope || '—' },
      ]}
      filterFn={(c, q) =>
        c.name.toLowerCase().includes(q) ||
        (c.group || '').toLowerCase().includes(q) ||
        (c.kind || '').toLowerCase().includes(q)
      }
      emptyMessage="No CRDs"
    />
  );
}
