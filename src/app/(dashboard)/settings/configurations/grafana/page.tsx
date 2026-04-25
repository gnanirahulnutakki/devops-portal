'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOrganizationStore, isAdmin } from '@/store/organization-store';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pencil, Plus, Trash2, RefreshCcw } from 'lucide-react';
import { OrgBanner } from '@/components/dashboard/org-banner';

type GrafanaAccount = {
  id: string;
  name: string;
  enabled: boolean;
  url?: string;
  hasApiKey?: boolean;
  updatedAt?: string;
  lastError?: string | null;
};

export default function GrafanaConfigurationsPage() {
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const orgId = currentOrganization?.id;
  const userIsAdmin = isAdmin(currentOrganization?.role);

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<GrafanaAccount[]>([]);

  const [settingsDraft, setSettingsDraft] = useState<any>({});
  const [savingDefault, setSavingDefault] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [active, setActive] = useState<GrafanaAccount | null>(null);

  const [createForm, setCreateForm] = useState({ name: '', url: '', apiKey: '' });
  const [editForm, setEditForm] = useState({ name: '', url: '', apiKey: '', enabled: true });
  const [busyId, setBusyId] = useState<string | null>(null);

  const defaultCredentialId = settingsDraft?.grafana?.credentialId as string | undefined;

  const enabledAccounts = useMemo(() => accounts.filter((a) => a.enabled), [accounts]);

  async function loadSettings() {
    if (!orgId) return;
    const res = await fetch('/api/organizations/settings', {
      headers: { 'x-organization-id': orgId },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSettingsDraft(data.data || {});
  }

  async function loadAccounts() {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/grafana/accounts', {
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to load Grafana accounts');
      setAccounts(data.data || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load Grafana accounts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
    void loadAccounts();
  }, [orgId]);

  const saveDefault = async (credentialId: string) => {
    if (!orgId) return;
    if (!userIsAdmin) {
      toast.error('Admin role required to change default Grafana account.');
      return;
    }
    setSavingDefault(true);
    try {
      const res = await fetch('/api/organizations/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-organization-id': orgId },
        body: JSON.stringify({
          ...settingsDraft,
          grafana: { ...(settingsDraft?.grafana || {}), credentialId },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed to save (HTTP ${res.status})`);
      toast.success('Default Grafana account updated.');
      setSettingsDraft(data.data || settingsDraft);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save default Grafana account');
    } finally {
      setSavingDefault(false);
    }
  };

  const openEdit = (a: GrafanaAccount) => {
    setActive(a);
    setEditForm({
      name: a.name,
      url: a.url || '',
      apiKey: '',
      enabled: a.enabled,
    });
    setEditOpen(true);
  };

  const openDelete = (a: GrafanaAccount) => {
    setActive(a);
    setDeleteOpen(true);
  };

  const createAccount = async () => {
    if (!orgId) return;
    if (!userIsAdmin) {
      toast.error('Admin role required to add Grafana accounts.');
      return;
    }
    if (!createForm.name || !createForm.url || !createForm.apiKey) {
      toast.error('Name, URL, and API key are required.');
      return;
    }
    setBusyId('create');
    try {
      const res = await fetch('/api/integrations/grafana/accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-organization-id': orgId },
        body: JSON.stringify(createForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('Grafana account created.');
      setCreateOpen(false);
      setCreateForm({ name: '', url: '', apiKey: '' });
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create Grafana account');
    } finally {
      setBusyId(null);
    }
  };

  const updateAccount = async () => {
    if (!orgId || !active) return;
    if (!userIsAdmin) {
      toast.error('Admin role required to edit Grafana accounts.');
      return;
    }
    if (!editForm.name || !editForm.url) {
      toast.error('Name and URL are required.');
      return;
    }
    setBusyId(active.id);
    try {
      const payload: any = {
        name: editForm.name,
        url: editForm.url,
        enabled: editForm.enabled,
      };
      if (editForm.apiKey) payload.apiKey = editForm.apiKey;

      const res = await fetch(`/api/integrations/grafana/accounts/${active.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-organization-id': orgId },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('Grafana account updated.');
      setEditOpen(false);
      setActive(null);
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update Grafana account');
    } finally {
      setBusyId(null);
    }
  };

  const deleteAccount = async () => {
    if (!orgId || !active) return;
    if (!userIsAdmin) {
      toast.error('Admin role required to delete Grafana accounts.');
      return;
    }
    setBusyId(active.id);
    try {
      const res = await fetch(`/api/integrations/grafana/accounts/${active.id}`, {
        method: 'DELETE',
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('Grafana account deleted.');
      setDeleteOpen(false);
      setActive(null);
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete Grafana account');
    } finally {
      setBusyId(null);
    }
  };

  const toggleEnabled = async (a: GrafanaAccount, enabled: boolean) => {
    if (!orgId) return;
    if (!userIsAdmin) {
      toast.error('Admin role required.');
      return;
    }
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/integrations/grafana/accounts/${a.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-organization-id': orgId },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      setAccounts((prev) => prev.map((x) => (x.id === a.id ? { ...x, enabled } : x)));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <OrgBanner />
          <h1 className="text-2xl font-bold tracking-tight">Grafana Configuration</h1>
          <p className="text-muted-foreground">Full CRUD for Grafana accounts. Tokens are never exposed to the browser.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadAccounts()} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)} disabled={!userIsAdmin}>
            <Plus className="h-4 w-4 mr-2" />
            Add account
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default account</CardTitle>
        </CardHeader>
        <CardContent className="max-w-md space-y-2">
          <Label>Used by Monitoring pages by default</Label>
          <Select
            value={defaultCredentialId}
            onValueChange={(v) => saveDefault(v)}
            disabled={!userIsAdmin || savingDefault}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select default Grafana account" />
            </SelectTrigger>
            <SelectContent>
              {enabledAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!userIsAdmin ? (
            <p className="text-xs text-muted-foreground">Admin role required to change defaults.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Auth</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                      No Grafana accounts yet. Add one to start using Monitoring.
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {a.name}
                            {a.lastError ? (
                              <Badge variant="destructive" title={a.lastError}>
                                Error
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground">{a.id}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="truncate block max-w-[420px]" title={a.url || ''}>
                          {a.url || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.hasApiKey ? 'API key set' : 'Missing'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={a.enabled}
                            onCheckedChange={(v) => toggleEnabled(a, v)}
                            disabled={!userIsAdmin || busyId === a.id}
                          />
                          <span className="text-xs text-muted-foreground">{a.enabled ? 'On' : 'Off'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.updatedAt ? new Date(a.updatedAt).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(a)} disabled={!userIsAdmin}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => openDelete(a)} disabled={!userIsAdmin}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Grafana account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} placeholder="prod" />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={createForm.url} onChange={(e) => setCreateForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://grafana.example.com" />
            </div>
            <div className="space-y-2">
              <Label>Service account token</Label>
              <Input value={createForm.apiKey} onChange={(e) => setCreateForm((p) => ({ ...p, apiKey: e.target.value }))} placeholder="glsa_..." type="password" />
              <p className="text-xs text-muted-foreground">Stored encrypted. Not displayed again.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createAccount} disabled={busyId === 'create'}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Grafana account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={editForm.url} onChange={(e) => setEditForm((p) => ({ ...p, url: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Service account token (optional)</Label>
              <Input value={editForm.apiKey} onChange={(e) => setEditForm((p) => ({ ...p, apiKey: e.target.value }))} placeholder="Leave blank to keep existing" type="password" />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Enabled</p>
                <p className="text-xs text-muted-foreground">Disable to temporarily hide this account.</p>
              </div>
              <Switch checked={editForm.enabled} onCheckedChange={(v) => setEditForm((p) => ({ ...p, enabled: v }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateAccount} disabled={!active || busyId === active?.id}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Grafana account</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">
              This will permanently delete <span className="font-medium">{active?.name}</span>.
            </p>
            <p className="text-xs text-muted-foreground">Dashboards/alerts using this account will stop working until a new account is selected.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteAccount} disabled={!active || busyId === active?.id}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

