'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

interface GrafanaAccount {
  id: string;
  name: string;
  enabled: boolean;
}

interface GrafanaDashboard {
  uid: string;
  title: string;
  url: string;
}

interface GrafanaPanel {
  id: number;
  title: string;
  type: string;
}

interface PanelSelection {
  credentialId?: string;
  dashboardUid: string;
  dashboardTitle: string;
  panelId: number;
  panelTitle: string;
}

interface UserPreferences {
  dashboardLayout?: Record<string, unknown> | null;
}

function extractPanels(layout?: Record<string, unknown> | null): PanelSelection[] {
  const panels = (layout?.grafanaPanels as any)?.panels;
  if (Array.isArray(panels)) {
    return panels as PanelSelection[];
  }
  return [];
}

function extractCredentialId(layout?: Record<string, unknown> | null): string | undefined {
  const id = (layout?.grafanaPanels as any)?.credentialId;
  return typeof id === 'string' ? id : undefined;
}

export function GrafanaPanels() {
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);
  const [accounts, setAccounts] = useState<GrafanaAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>();
  const [dashboards, setDashboards] = useState<GrafanaDashboard[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<string | undefined>();
  const [panels, setPanels] = useState<GrafanaPanel[]>([]);
  const [selectedPanel, setSelectedPanel] = useState<string | undefined>();
  const [savedPanels, setSavedPanels] = useState<PanelSelection[]>([]);
  const [dashboardLayout, setDashboardLayout] = useState<Record<string, unknown> | null>(null);


  const orgId = currentOrganization?.id;

  const accountOptions = useMemo(
    () => accounts.filter((a) => a.enabled),
    [accounts]
  );

  const activeAccount = useMemo(
    () => accountOptions.find((a) => a.id === selectedAccount),
    [accountOptions, selectedAccount]
  );

  async function fetchPreferences() {
    if (!orgId) return;
    const res = await fetch('/api/user-preferences', {
      headers: { 'x-organization-id': orgId },
    });
    const data = await res.json();
    if (res.ok) {
      const layout = (data.data as UserPreferences)?.dashboardLayout as Record<string, unknown> | null;
      setDashboardLayout(layout);
      const saved = extractPanels(layout);
      setSavedPanels(saved);
      const credentialId = extractCredentialId(layout);
      if (credentialId) {
        setSelectedAccount(credentialId);
      }
    }
  }

  async function savePreferences(panels: PanelSelection[], credentialId?: string) {
    if (!orgId) return;
    const nextLayout = {
      ...(dashboardLayout || {}),
      grafanaPanels: {
        credentialId,
        panels,
      },
    };
    setDashboardLayout(nextLayout);
    await fetch('/api/user-preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-organization-id': orgId,
      },
      body: JSON.stringify({ dashboardLayout: nextLayout }),
    });
  }

  async function fetchAccounts() {
    if (!orgId) return;
    const res = await fetch('/api/integrations/grafana/accounts', {
      headers: { 'x-organization-id': orgId },
    });
    const data = await res.json();
    if (res.ok) {
      setAccounts(data.data || []);
    }
  }

  async function fetchDashboards(credentialId?: string) {
    if (!orgId || !credentialId) {
      setDashboards([]);
      return;
    }
    const res = await fetch(
      `/api/monitoring/grafana/dashboards?credentialId=${encodeURIComponent(credentialId)}`,
      { headers: { 'x-organization-id': orgId } }
    );
    const data = await res.json();
    if (res.ok) {
      setDashboards(data.data || []);
    } else {
      setDashboards([]);
    }
  }

  async function fetchPanels(credentialId: string, uid: string) {
    if (!orgId) return;
    const res = await fetch(
      `/api/monitoring/grafana/panels?uid=${encodeURIComponent(uid)}&credentialId=${encodeURIComponent(credentialId)}`,
      { headers: { 'x-organization-id': orgId } }
    );
    const data = await res.json();
    if (res.ok) {
      setPanels(data.data || []);
    } else {
      setPanels([]);
    }
  }

  useEffect(() => {
    fetchAccounts();
    fetchPreferences();
  }, [orgId]);

  useEffect(() => {
    if (!selectedAccount && accountOptions[0]) {
      setSelectedAccount(accountOptions[0].id);
    }
  }, [accountOptions, selectedAccount]);

  useEffect(() => {
    if (selectedAccount) {
      fetchDashboards(selectedAccount);
      savePreferences(savedPanels, selectedAccount);
    }
  }, [selectedAccount]);

  useEffect(() => {
    if (selectedAccount && selectedDashboard) {
      fetchPanels(selectedAccount, selectedDashboard);
    }
  }, [selectedAccount, selectedDashboard]);

  const handleAddPanel = async () => {
    if (!selectedAccount || !selectedDashboard || !selectedPanel) {
      toast.error('Select a dashboard panel first');
      return;
    }
    const dashboard = dashboards.find((d) => d.uid === selectedDashboard);
    const panel = panels.find((p) => String(p.id) === selectedPanel);
    if (!dashboard || !panel) return;

    const nextPanels = [
      ...savedPanels,
      {
        credentialId: selectedAccount,
        dashboardUid: dashboard.uid,
        dashboardTitle: dashboard.title,
        panelId: panel.id,
        panelTitle: panel.title,
      },
    ];
    setSavedPanels(nextPanels);
    await savePreferences(nextPanels, selectedAccount);
  };

  const handleRemovePanel = async (index: number) => {
    const nextPanels = savedPanels.filter((_, i) => i !== index);
    setSavedPanels(nextPanels);
    await savePreferences(nextPanels, selectedAccount);
  };


  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Grafana Panels</CardTitle>
          <CardDescription>
            Add key Grafana panels to your dashboard and switch accounts.
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => (window.location.href = '/settings')}>
          Manage Accounts
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Grafana Account</Label>
            <Select
              value={selectedAccount}
              onValueChange={(value) => setSelectedAccount(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dashboard</Label>
            <Select
              value={selectedDashboard}
              onValueChange={(value) => setSelectedDashboard(value)}
              disabled={!selectedAccount}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select dashboard" />
              </SelectTrigger>
              <SelectContent>
                {dashboards.map((dashboard) => (
                  <SelectItem key={dashboard.uid} value={dashboard.uid}>
                    {dashboard.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Panel</Label>
            <Select
              value={selectedPanel}
              onValueChange={(value) => setSelectedPanel(value)}
              disabled={!selectedDashboard}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select panel" />
              </SelectTrigger>
              <SelectContent>
                {panels.map((panel) => (
                  <SelectItem key={panel.id} value={String(panel.id)}>
                    {panel.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleAddPanel} disabled={!activeAccount}>
            Add Panel
          </Button>
        </div>

        {savedPanels.length === 0 ? (
          <div className="text-sm text-muted-foreground">No panels pinned yet.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {savedPanels.map((panel, index) => {
              const credentialQuery = panel.credentialId
                ? `&credentialId=${encodeURIComponent(panel.credentialId)}`
                : '';
              return (
              <Card key={`${panel.dashboardUid}:${panel.panelId}:${index}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{panel.panelTitle}</CardTitle>
                      <CardDescription>{panel.dashboardTitle}</CardDescription>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemovePanel(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <img
                    src={`/api/monitoring/grafana/render?uid=${encodeURIComponent(panel.dashboardUid)}&panelId=${panel.panelId}&width=900&height=300${credentialQuery}`}
                    alt={panel.panelTitle}
                    className="w-full rounded-md border"
                  />
                </CardContent>
              </Card>
            );})}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
