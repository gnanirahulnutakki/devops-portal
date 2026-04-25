'use client';

import { use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft } from 'lucide-react';
import { PodLogStream } from '@/components/dashboard/pod-log-stream';
import { ClusterYamlEditor } from '@/components/dashboard/cluster-yaml-editor';
import { PodMetricsChart } from '@/components/dashboard/pod-metrics-chart';

interface PodDetail {
  name: string;
  namespace: string;
  status: string;
  ready?: string;
  restarts?: number;
  age?: string;
  node?: string;
  containers?: string[];
}

export default function PodDetailPage({ params }: { params: Promise<{ id: string; name: string }> }) {
  const { id, name } = use(params);
  const search = useSearchParams();
  const namespace = search.get('namespace') || '';
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);

  const [pod, setPod] = useState<PodDetail | null>(null);
  const [container, setContainer] = useState<string>('');

  useEffect(() => {
    if (!orgId || !namespace) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/clusters/${id}/pods?namespace=${encodeURIComponent(namespace)}`, {
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json();
      if (cancelled) return;
      if (res.ok) {
        const found = (data.data as PodDetail[] | undefined)?.find((p) => p.name === name);
        if (found) {
          setPod(found);
          if (found.containers?.[0]) {
            setContainer((current) => current || found.containers![0] || '');
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, id, namespace, name]);

  if (!namespace) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Missing <code>?namespace=...</code> query param. Open this pod from the pods list to navigate correctly.
          </p>
          <Link href={`/clusters/${id}/pods`}>
            <Button variant="link" className="px-0">Back to pods</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/clusters/${id}/pods`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ChevronLeft className="h-3 w-3" /> Pods
          </Link>
          <h1 className="text-2xl font-bold mt-1">{name}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            <Badge variant="secondary">{namespace}</Badge>
            {pod?.status && <Badge>{pod.status}</Badge>}
            {pod?.ready && <span>{pod.ready} ready</span>}
            {pod?.node && <span>on {pod.node}</span>}
          </p>
        </div>
      </div>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="yaml">YAML</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-3">
          {pod?.containers && pod.containers.length > 1 && (
            <div className="flex items-center gap-2 max-w-md">
              <span className="text-xs text-muted-foreground">Container:</span>
              <Select value={container} onValueChange={setContainer}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Choose container" />
                </SelectTrigger>
                <SelectContent>
                  {pod.containers.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <PodLogStream
            clusterId={id}
            namespace={namespace}
            podName={name}
            container={container || undefined}
          />
        </TabsContent>

        <TabsContent value="metrics">
          <PodMetricsChart clusterId={id} namespace={namespace} podName={name} />
        </TabsContent>

        <TabsContent value="yaml">
          <ClusterYamlEditor
            clusterId={id}
            kind="Pod"
            name={name}
            namespace={namespace}
          />
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Pod summary</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <Row label="Name" value={name} />
              <Row label="Namespace" value={namespace} />
              <Row label="Status" value={pod?.status || '—'} />
              <Row label="Ready" value={pod?.ready || '—'} />
              <Row label="Restarts" value={String(pod?.restarts ?? 0)} />
              <Row label="Node" value={pod?.node || '—'} />
              <Row label="Containers" value={pod?.containers?.join(', ') || '—'} />
              <Row label="Age" value={pod?.age || '—'} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
