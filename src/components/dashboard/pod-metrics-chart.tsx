'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart } from '@tremor/react';
import { AlertTriangle } from 'lucide-react';

interface PodMetricsChartProps {
  clusterId: string;
  namespace: string;
  podName: string;
  /** Sample interval in ms. Default 10000 (10s). */
  intervalMs?: number;
  /** Buffer length (number of samples kept). Default 30 (5 min @ 10s). */
  bufferSize?: number;
}

interface SamplePoint {
  t: string; // formatted time label
  cpuMilli: number;
  memoryMB: number;
}

export function PodMetricsChart({
  clusterId,
  namespace,
  podName,
  intervalMs = 10_000,
  bufferSize = 30,
}: PodMetricsChartProps) {
  const [samples, setSamples] = useState<SamplePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/clusters/${clusterId}/pods/${encodeURIComponent(podName)}/metrics?namespace=${encodeURIComponent(namespace)}`,
        );
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          if (data?.error?.code === 'METRICS_SERVER_UNAVAILABLE') {
            setUnavailable(true);
          } else {
            setError(data?.error?.message || `HTTP ${res.status}`);
          }
          return;
        }

        const containers = (data.data?.containers || []) as Array<{ cpuMilli: number; memoryBytes: number }>;
        const cpuTotal = containers.reduce((s, c) => s + (c.cpuMilli || 0), 0);
        const memTotal = containers.reduce((s, c) => s + (c.memoryBytes || 0), 0);

        const point: SamplePoint = {
          t: new Date().toLocaleTimeString(),
          cpuMilli: cpuTotal,
          memoryMB: Math.round(memTotal / 1024 / 1024),
        };

        setSamples((prev) => {
          const next = [...prev, point];
          return next.length > bufferSize ? next.slice(-bufferSize) : next;
        });
        setError(null);
        setUnavailable(false);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Fetch failed');
      }
    };

    void tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [clusterId, namespace, podName, intervalMs, bufferSize]);

  if (unavailable) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-foreground">Metrics not available</p>
            <p>
              metrics-server isn't installed in this cluster, or this pod hasn't reported yet. Install
              <code className="mx-1 px-1 bg-muted rounded">metrics-server</code>
              to enable pod resource charts.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">CPU (millicores)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Last {samples.length}/{bufferSize} samples · {intervalMs / 1000}s interval
          </p>
        </CardHeader>
        <CardContent>
          {samples.length === 0 ? (
            <p className="text-sm text-muted-foreground">Waiting for first sample…</p>
          ) : (
            <AreaChart
              className="h-40"
              data={samples}
              index="t"
              categories={['cpuMilli']}
              colors={['blue']}
              valueFormatter={(v: number) => `${v} m`}
              showLegend={false}
              showXAxis={false}
              yAxisWidth={48}
            />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Memory (MB)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Working set (kernel-reported), excluding inactive file cache
          </p>
        </CardHeader>
        <CardContent>
          {samples.length === 0 ? (
            <p className="text-sm text-muted-foreground">Waiting for first sample…</p>
          ) : (
            <AreaChart
              className="h-40"
              data={samples}
              index="t"
              categories={['memoryMB']}
              colors={['emerald']}
              valueFormatter={(v: number) => `${v} MB`}
              showLegend={false}
              showXAxis={false}
              yAxisWidth={56}
            />
          )}
        </CardContent>
      </Card>
      {error && (
        <Card className="md:col-span-2 border-destructive/50">
          <CardContent className="pt-6 text-xs text-destructive">{error}</CardContent>
        </Card>
      )}
    </div>
  );
}
