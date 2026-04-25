'use client';

import { use } from 'react';
import { ClusterResourceTable } from '@/components/dashboard/cluster-resource-table';
import { Badge } from '@/components/ui/badge';

interface EventItem {
  name: string;
  namespace: string;
  type: string;
  reason: string;
  message: string;
  object: string;
  count: number;
  lastSeen: string;
}

const TYPE_VARIANT = (t: string): 'default' | 'destructive' | 'secondary' => {
  if (t === 'Warning') return 'destructive';
  if (t === 'Normal') return 'default';
  return 'secondary';
};

export default function EventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ClusterResourceTable<EventItem>
      clusterId={id}
      resource="events"
      title="Events"
      columns={[
        { key: 'lastSeen', label: 'Last Seen', render: (e) => e.lastSeen ? new Date(e.lastSeen).toLocaleString() : '—', className: 'text-muted-foreground whitespace-nowrap' },
        { key: 'type', label: 'Type', render: (e) => <Badge variant={TYPE_VARIANT(e.type)}>{e.type}</Badge> },
        { key: 'reason', label: 'Reason', render: (e) => <span className="font-medium">{e.reason}</span> },
        { key: 'object', label: 'Object', render: (e) => e.object || '—' },
        { key: 'namespace', label: 'Namespace', render: (e) => <Badge variant="secondary">{e.namespace}</Badge> },
        { key: 'message', label: 'Message', render: (e) => <span className="text-xs">{e.message}</span> },
        { key: 'count', label: 'Count', render: (e) => e.count },
      ]}
      filterFn={(e, q) =>
        e.reason.toLowerCase().includes(q) ||
        e.message.toLowerCase().includes(q) ||
        (e.object || '').toLowerCase().includes(q) ||
        (e.namespace || '').toLowerCase().includes(q)
      }
      emptyMessage="No events"
    />
  );
}
