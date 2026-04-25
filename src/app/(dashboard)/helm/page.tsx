'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';

interface ClusterItem {
  id: string;
  name: string;
}

interface HelmRelease {
  name: string;
  namespace: string;
  revision?: number;
  status: string;
  chart?: string;
  updatedAt?: string;
}

export default function HelmPage() {
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);
  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [selectedCluster, setSelectedCluster] = useState('');
  const [releases, setReleases] = useState<HelmRelease[]>([]);
  const [loading, setLoading] = useState(false);

  const orgId = currentOrganization?.id;

  const loadClusters = useCallback(async () => {
    if (!orgId) return;
    const res = await fetch('/api/clusters', { headers: { 'x-organization-id': orgId } });
    const data = await res.json();
    if (res.ok) {
      setClusters(data.data || []);
      setSelectedCluster((current) => current || data.data?.[0]?.id || '');
    }
  }, [orgId]);

  const loadReleases = useCallback(async () => {
    if (!orgId || !selectedCluster) return;
    setLoading(true);
    const res = await fetch(`/api/clusters/${selectedCluster}/helm`, {
      headers: { 'x-organization-id': orgId },
    });
    const data = await res.json();
    if (res.ok) setReleases(data.data || []);
    setLoading(false);
  }, [orgId, selectedCluster]);

  useEffect(() => {
    void loadClusters();
  }, [loadClusters]);

  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Helm Releases</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View release inventory across clusters
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadReleases}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cluster</CardTitle>
          <CardDescription>Select a cluster to list Helm releases</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedCluster} onValueChange={setSelectedCluster}>
            <SelectTrigger>
              <SelectValue placeholder="Select cluster" />
            </SelectTrigger>
            <SelectContent>
              {clusters.map((cluster) => (
                <SelectItem key={cluster.id} value={cluster.id}>
                  {cluster.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Releases</CardTitle>
          <CardDescription>{loading ? 'Loading releases...' : `${releases.length} releases`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!loading && releases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Helm releases found.</p>
          ) : null}
          {releases.map((release) => (
            <div key={`${release.namespace}-${release.name}`} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{release.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {release.namespace} • {release.chart || 'chart unknown'}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">{release.status}</span>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Values.yaml rendering is not yet available. We can add it by decoding Helm release secrets or wiring
            a Helm service endpoint.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
