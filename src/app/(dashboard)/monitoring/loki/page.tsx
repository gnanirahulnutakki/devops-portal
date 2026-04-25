'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExternalLink } from 'lucide-react';
import { OrgBanner } from '@/components/dashboard/org-banner';

interface GrafanaAccount {
  id: string;
  name: string;
  enabled: boolean;
}

function buildExploreUrl({
  datasourceUid,
  query,
}: {
  datasourceUid: string;
  query: string;
}) {
  // Grafana Explore "left" param is URL-encoded JSON.
  // We'll keep it minimal and let users use Explore UI from there.
  const left = encodeURIComponent(
    JSON.stringify({
      datasource: datasourceUid,
      queries: [
        {
          datasource: { uid: datasourceUid },
          expr: query || '{job=~".+"}',
          queryType: 'range',
          refId: 'A',
        },
      ],
      range: { from: 'now-1h', to: 'now' },
    })
  );
  return `/grafana/explore?left=${left}`;
}

export default function LokiLogsPage() {
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const orgId = currentOrganization?.id;
  const [accounts, setAccounts] = useState<GrafanaAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>();
  const [datasources, setDatasources] = useState<{ uid: string; name: string; type: string }[]>([]);
  const [selectedDatasource, setSelectedDatasource] = useState<string | undefined>();
  const [query, setQuery] = useState('{job=~".+"}');

  const enabledAccounts = useMemo(() => accounts.filter((a) => a.enabled), [accounts]);

  useEffect(() => {
    if (!orgId) return;
    const oid = orgId;
    let cancelled = false;
    async function loadAccounts() {
      const res = await fetch('/api/integrations/grafana/accounts', {
        headers: { 'x-organization-id': oid },
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (res.ok) {
        setAccounts(data.data || []);
        setSelectedAccount((current) => current || data.data?.[0]?.id || '');
      }
    }
    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // Load Loki datasources from Grafana via the portal proxy (server-side token injection).
  useEffect(() => {
    const accountId = selectedAccount;
    if (!accountId) return;
    let cancelled = false;
    async function loadDatasources() {
      // This API call must go through /grafana so the token is injected.
      const res = await fetch(`/grafana/api/datasources?credentialId=${encodeURIComponent(accountId!)}`);
      const data = await res.json().catch(() => []);
      if (cancelled) return;
      if (Array.isArray(data)) {
        const loki = data
          .filter((d: any) => String(d?.type || '').toLowerCase() === 'loki')
          .map((d: any) => ({ uid: d.uid, name: d.name, type: d.type }));
        setDatasources(loki);
        setSelectedDatasource((current) => current || loki[0]?.uid || '');
      } else {
        setDatasources([]);
      }
    }
    void loadDatasources();
    return () => {
      cancelled = true;
    };
  }, [selectedAccount]);

  const exploreUrl =
    selectedDatasource
      ? buildExploreUrl({ datasourceUid: selectedDatasource, query })
      : undefined;

  return (
    <div className="space-y-6">
      <div>
        <OrgBanner />
        <h1 className="text-2xl font-bold tracking-tight">Loki Logs</h1>
        <p className="text-muted-foreground">
          When a Loki datasource exists in Grafana, open Explore inside the portal and query logs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Explore (Grafana)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
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
              <Label>Loki datasource</Label>
              <Select value={selectedDatasource} onValueChange={setSelectedDatasource}>
                <SelectTrigger>
                  <SelectValue placeholder={selectedAccount ? 'Select datasource' : 'Select Grafana account first'} />
                </SelectTrigger>
                <SelectContent>
                  {datasources.map((d) => (
                    <SelectItem key={d.uid} value={d.uid}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccount && datasources.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No Loki datasource detected in this Grafana account.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>LogQL query</Label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='{app="myapp"}' />
              <p className="text-xs text-muted-foreground">Example: <span className="font-mono">{`{namespace="default"}`}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild disabled={!exploreUrl}>
              <a href={exploreUrl || '#'} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Explore in portal
              </a>
            </Button>
          </div>

          {exploreUrl ? (
            <div className="h-[75vh] overflow-hidden rounded-md border bg-background">
              <iframe
                src={exploreUrl}
                className="h-full w-full"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="strict-origin-when-cross-origin"
                title="Grafana Explore (Loki)"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

