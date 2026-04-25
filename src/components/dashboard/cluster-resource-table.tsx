'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface ClusterResourceTableProps<T> {
  clusterId: string;
  resource: string;
  title: string;
  columns: Column<T>[];
  filterFn?: (row: T, q: string) => boolean;
  emptyMessage?: string;
  /** Auto-refresh interval in ms. Pass 0 (default) to disable. */
  refreshInterval?: number;
}

export function ClusterResourceTable<T>({
  clusterId,
  resource,
  title,
  columns,
  filterFn,
  emptyMessage = 'No items',
  refreshInterval = 0,
}: ClusterResourceTableProps<T>) {
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clusters/${clusterId}/${resource}`, {
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json();
      if (res.ok) setItems((data.data as T[]) || []);
    } finally {
      setLoading(false);
    }
  }, [orgId, clusterId, resource]);

  useEffect(() => {
    void load();
    if (refreshInterval > 0) {
      const id = setInterval(() => void load(), refreshInterval);
      return () => clearInterval(id);
    }
  }, [load, refreshInterval]);

  const filtered = useMemo(() => {
    if (!filter || !filterFn) return items;
    return items.filter((row) => filterFn(row, filter.toLowerCase()));
  }, [items, filter, filterFn]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {filterFn && (
        <Input
          placeholder={`Filter ${title.toLowerCase()}…`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-md"
        />
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className={`text-left px-3 py-2 font-medium ${col.className || ''}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-t">
                      {columns.map((col) => (
                        <td key={col.key} className="px-3 py-2">
                          <Skeleton className="h-4 w-32" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-10 text-muted-foreground">
                      {filter ? 'No matches' : emptyMessage}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, i) => (
                    <tr key={i} className="border-t hover:bg-accent/30">
                      {columns.map((col) => (
                        <td key={col.key} className={`px-3 py-2 ${col.className || ''}`}>
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
