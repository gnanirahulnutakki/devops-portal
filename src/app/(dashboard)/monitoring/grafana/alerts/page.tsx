'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GrafanaAlertList } from '@/components/monitoring/grafana-alert-list';

interface GrafanaAccount {
  id: string;
  name: string;
  enabled: boolean;
}

export default function GrafanaAlertsPage() {
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const orgId = currentOrganization?.id;
  const [accounts, setAccounts] = useState<GrafanaAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>();

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
  }, [orgId]); // intentionally not depending on selectedAccount

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Grafana Alerts</h1>
        <p className="text-muted-foreground">
          List alert rules from the selected Grafana account and open them in the portal to view/edit in Grafana.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm space-y-2">
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

          <GrafanaAlertList credentialId={selectedAccount} />
        </CardContent>
      </Card>
    </div>
  );
}

