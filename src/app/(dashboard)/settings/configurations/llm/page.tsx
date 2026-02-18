'use client';

import { useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Pencil, Plus, Trash2, RefreshCcw } from 'lucide-react';
import { OrgBanner } from '@/components/dashboard/org-banner';

type LlmAccount = {
  id: string;
  name: string;
  enabled: boolean;
  llmProvider?: string;
  baseUrl?: string;
  model?: string;
  hasApiKey?: boolean;
  lastError?: string | null;
};

export default function LlmConfigurationsPage() {
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const orgId = currentOrganization?.id;
  const userIsAdmin = isAdmin(currentOrganization?.role);

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<LlmAccount[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [active, setActive] = useState<LlmAccount | null>(null);

  const [createForm, setCreateForm] = useState({
    name: '',
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: '',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: '',
    enabled: true,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadAccounts() {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/llm/accounts', {
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to load LLM accounts');
      setAccounts(data.data || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load LLM accounts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, [orgId]);

  const openEdit = (a: LlmAccount) => {
    setActive(a);
    setEditForm({
      name: a.name,
      provider: a.llmProvider || 'openai',
      apiKey: '',
      baseUrl: a.baseUrl || '',
      model: a.model || '',
      enabled: a.enabled,
    });
    setEditOpen(true);
  };

  const openDelete = (a: LlmAccount) => {
    setActive(a);
    setDeleteOpen(true);
  };

  const createAccount = async () => {
    if (!orgId) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    if (!createForm.name || !createForm.provider || !createForm.apiKey) return toast.error('Name, provider, and apiKey are required.');
    setBusyId('create');
    try {
      const res = await fetch('/api/integrations/llm/accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-organization-id': orgId },
        body: JSON.stringify({
          name: createForm.name,
          provider: createForm.provider,
          apiKey: createForm.apiKey,
          baseUrl: createForm.baseUrl || undefined,
          model: createForm.model || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('LLM account created.');
      setCreateOpen(false);
      setCreateForm({ name: '', provider: 'openai', apiKey: '', baseUrl: '', model: '' });
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create LLM account');
    } finally {
      setBusyId(null);
    }
  };

  const updateAccount = async () => {
    if (!orgId || !active) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    if (!editForm.name || !editForm.provider) return toast.error('Name and provider are required.');
    setBusyId(active.id);
    try {
      const payload: any = {
        name: editForm.name,
        enabled: editForm.enabled,
        provider: editForm.provider,
        baseUrl: editForm.baseUrl || undefined,
        model: editForm.model || undefined,
      };
      if (editForm.apiKey) payload.apiKey = editForm.apiKey;

      const res = await fetch(`/api/integrations/llm/accounts/${active.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-organization-id': orgId },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('LLM account updated.');
      setEditOpen(false);
      setActive(null);
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update LLM account');
    } finally {
      setBusyId(null);
    }
  };

  const deleteAccount = async () => {
    if (!orgId || !active) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    setBusyId(active.id);
    try {
      const res = await fetch(`/api/integrations/llm/accounts/${active.id}`, {
        method: 'DELETE',
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('LLM account deleted.');
      setDeleteOpen(false);
      setActive(null);
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete LLM account');
    } finally {
      setBusyId(null);
    }
  };

  const toggleEnabled = async (a: LlmAccount, enabled: boolean) => {
    if (!orgId) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/integrations/llm/accounts/${a.id}`, {
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
          <h1 className="text-2xl font-bold tracking-tight">LLM Configuration</h1>
          <p className="text-muted-foreground">CRUD for LLM providers/keys/models.</p>
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
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Base URL</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                      No LLM accounts yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {a.name}
                          {a.lastError ? (
                            <Badge variant="destructive" title={a.lastError}>
                              Error
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{a.id}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.llmProvider || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="truncate block max-w-[260px]" title={a.baseUrl || ''}>
                          {a.baseUrl || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.model || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.hasApiKey ? 'Set' : 'Missing'}</Badge>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add LLM account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Input value={createForm.provider} onChange={(e) => setCreateForm((p) => ({ ...p, provider: e.target.value }))} placeholder="openai" />
            </div>
            <div className="space-y-2">
              <Label>API key</Label>
              <Input value={createForm.apiKey} onChange={(e) => setCreateForm((p) => ({ ...p, apiKey: e.target.value }))} type="password" />
            </div>
            <div className="space-y-2">
              <Label>Base URL (optional)</Label>
              <Input value={createForm.baseUrl} onChange={(e) => setCreateForm((p) => ({ ...p, baseUrl: e.target.value }))} placeholder="https://api.openai.com/v1" />
            </div>
            <div className="space-y-2">
              <Label>Model (optional)</Label>
              <Input value={createForm.model} onChange={(e) => setCreateForm((p) => ({ ...p, model: e.target.value }))} placeholder="gpt-4o-mini" />
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit LLM account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Input value={editForm.provider} onChange={(e) => setEditForm((p) => ({ ...p, provider: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>API key (optional)</Label>
              <Input value={editForm.apiKey} onChange={(e) => setEditForm((p) => ({ ...p, apiKey: e.target.value }))} placeholder="Leave blank to keep existing" type="password" />
            </div>
            <div className="space-y-2">
              <Label>Base URL (optional)</Label>
              <Input value={editForm.baseUrl} onChange={(e) => setEditForm((p) => ({ ...p, baseUrl: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Model (optional)</Label>
              <Input value={editForm.model} onChange={(e) => setEditForm((p) => ({ ...p, model: e.target.value }))} />
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

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete LLM account</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">
              This will permanently delete <span className="font-medium">{active?.name}</span>.
            </p>
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

