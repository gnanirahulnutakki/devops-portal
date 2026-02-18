'use client';

import useSWR from 'swr';
import { useEffect, useMemo, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RefreshCcw, AlertTriangle, Clock, Flame, ExternalLink, Activity } from 'lucide-react';

interface GrafanaAccount {
  id: string;
  name: string;
  enabled: boolean;
}

type InsightsPayload = {
  window: { fromMs: number; toMs: number; rangeMs: number };
  usedFallback: boolean;
  stats: { totalEvents: number; stateCounts: Record<string, number> };
  topNoisy: { title: string; count: number }[];
  recent10: { id: number; time: number; state: string; title: string; text: string; tags: string[] }[];
  hourly: Record<string, number>;
  activeSummary: { title: string; state: string; startsAt?: string; labels: Record<string, string> }[];
  drilldown?: any | null;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Failed to fetch insights');
  return data?.data as InsightsPayload;
};

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function GrafanaAlertInsightsPage() {
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const orgId = currentOrganization?.id;
  const [accounts, setAccounts] = useState<GrafanaAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>();
  const [range, setRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [filter, setFilter] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const enabledAccounts = useMemo(() => accounts.filter((a) => a.enabled), [accounts]);

  useEffect(() => {
    if (!orgId) return;
    const oid = orgId;
    let cancelled = false;
    async function load() {
      const res = await fetch('/api/integrations/grafana/accounts', {
        headers: { 'x-organization-id': oid },
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (res.ok) {
        setAccounts(data.data || []);
        if (!selectedAccount && data.data?.[0]) setSelectedAccount(data.data[0].id);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const query = selectedAccount
    ? `?credentialId=${encodeURIComponent(selectedAccount)}&range=${encodeURIComponent(range)}`
    : `?range=${encodeURIComponent(range)}`;

  const { data, error, isLoading, mutate } = useSWR<InsightsPayload>(
    `/api/monitoring/grafana/insights${query}`,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 60_000 }
  );

  const ddQuery = useMemo(() => {
    if (!selectedKey) return null;
    const base = selectedAccount
      ? `?credentialId=${encodeURIComponent(selectedAccount)}&range=${encodeURIComponent(range)}`
      : `?range=${encodeURIComponent(range)}`;
    return `/api/monitoring/grafana/insights${base}&alertKey=${encodeURIComponent(selectedKey)}`;
  }, [selectedAccount, range, selectedKey]);

  const { data: ddData, error: ddError, isLoading: ddLoading } = useSWR<any>(
    ddQuery,
    async (u: string) => {
      const res = await fetch(u);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to fetch drilldown');
      return json?.data?.drilldown;
    },
    { revalidateOnFocus: false }
  );

  const filteredRecent = useMemo(() => {
    const items = data?.recent10 || [];
    if (!filter) return items;
    const q = filter.toLowerCase();
    return items.filter((e) => e.title.toLowerCase().includes(q) || e.text.toLowerCase().includes(q));
  }, [data?.recent10, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grafana Alert Insights</h1>
          <p className="text-muted-foreground">
            Noisy alerts, recent alert events, and trend analysis for the selected Grafana account.
          </p>
          {data?.usedFallback ? (
            <p className="text-xs text-muted-foreground mt-1">
              Showing a fallback snapshot (Alertmanager active alerts). For full “most alerted” + “recent events”, enable Grafana alert annotations/history.
            </p>
          ) : null}
        </div>
        <Button variant="outline" onClick={() => mutate()} disabled={isLoading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Grafana Account</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Grafana account" />
                </SelectTrigger>
                <SelectContent>
                  {enabledAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time window</Label>
              <Select value={range} onValueChange={(v: any) => setRange(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last 1 hour</SelectItem>
                  <SelectItem value="6h">Last 6 hours</SelectItem>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {error ? (
              <div className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {error.message}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                {range}
              </Badge>
              <Badge variant="secondary">
                {data?.stats?.totalEvents ?? 0} events
              </Badge>
              {Object.entries(data?.stats?.stateCounts || {}).slice(0, 6).map(([k, v]) => (
                <Badge key={k} variant="outline">
                  {k}: {v}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              “Most alerted” counts are based on events that transition into <span className="font-medium">alerting</span>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Noisiest alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.topNoisy || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No alerting events found in this window.</p>
            ) : (
              <div className="space-y-2">
                {data!.topNoisy.slice(0, 8).map((a) => (
                  <button
                    key={a.title}
                    type="button"
                    onClick={() => setSelectedKey(a.title)}
                    className="w-full flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" title={a.title}>
                        {a.title}
                      </p>
                      <p className="text-xs text-muted-foreground">Click for details</p>
                    </div>
                    <Badge variant="destructive" className="shrink-0">
                      <Flame className="h-3 w-3 mr-1" />
                      {a.count}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent alert events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter recent events by title or text…"
              className="max-w-sm"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Alert</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(filteredRecent || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      {isLoading ? 'Loading…' : 'No recent events found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecent.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <span title={new Date(e.time).toLocaleString()}>{timeAgo(e.time)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.state === 'alerting' ? 'destructive' : 'outline'}>{e.state}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className="truncate block max-w-[420px]" title={e.title}>
                          {e.title}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="truncate block max-w-[520px]" title={e.text}>
                          {e.text}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedKey)} onOpenChange={(o) => (!o ? setSelectedKey(null) : null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Alert analysis</DialogTitle>
          </DialogHeader>

          {ddLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : ddError ? (
            <div className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {String(ddError.message || ddError)}
            </div>
          ) : ddData ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{ddData.totalEvents} events</Badge>
                <Badge variant="destructive">{ddData.alertingCount} alerting</Badge>
                <Badge variant="outline">{ddData.transitions} transitions</Badge>
                {ddData.firstSeen ? (
                  <Badge variant="outline" title={new Date(ddData.firstSeen).toLocaleString()}>
                    First: {timeAgo(ddData.firstSeen)}
                  </Badge>
                ) : null}
                {ddData.lastSeen ? (
                  <Badge variant="outline" title={new Date(ddData.lastSeen).toLocaleString()}>
                    Last: {timeAgo(ddData.lastSeen)}
                  </Badge>
                ) : null}
              </div>

              <div>
                <p className="text-base font-semibold">{ddData.alertKey}</p>
                {ddData.rule?.portalViewUrl ? (
                  <div className="flex items-center gap-2 mt-2">
                    <Button asChild size="sm">
                      <a href={ddData.rule.portalViewUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open rule
                      </a>
                    </Button>
                    <Button asChild size="sm" variant="secondary">
                      <a href={ddData.rule.portalEditUrl} target="_blank" rel="noopener noreferrer">
                        <Activity className="h-4 w-4 mr-2" />
                        Edit rule
                      </a>
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {ddData.rule.folderTitle ? `Folder: ${ddData.rule.folderTitle}` : ''}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">
                    Rule deep-link not found (title mismatch). We can improve matching if you want.
                  </p>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">State breakdown</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {Object.entries(ddData.stateCounts || {}).map(([k, v]: any) => (
                    <Badge key={k} variant={k === 'alerting' ? 'destructive' : 'outline'}>
                      {k}: {v}
                    </Badge>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead>Text</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(ddData.recent || []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                              No events.
                            </TableCell>
                          </TableRow>
                        ) : (
                          ddData.recent.slice(0, 20).map((e: any) => (
                            <TableRow key={e.id}>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                <span title={new Date(e.time).toLocaleString()}>{timeAgo(e.time)}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={e.state === 'alerting' ? 'destructive' : 'outline'}>{e.state}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                <span className="truncate block max-w-[760px]" title={e.text}>
                                  {e.text}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No data.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

