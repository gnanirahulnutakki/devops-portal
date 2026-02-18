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

type ArgoAccount = {
  id: string;
  name: string;
  enabled: boolean;
  url?: string;
  insecure?: boolean;
  hasToken?: boolean;
  updatedAt?: string;
  lastError?: string | null;
};

export default function ArgoCdConfigurationsPage() {
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const orgId = currentOrganization?.id;
  const userIsAdmin = isAdmin(currentOrganization?.role);

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<ArgoAccount[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [active, setActive] = useState<ArgoAccount | null>(null);

  const [createForm, setCreateForm] = useState({ name: '', url: '', token: '', insecure: false });
  const [editForm, setEditForm] = useState({ name: '', url: '', token: '', insecure: false, enabled: true });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadAccounts() {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/argocd/accounts', {
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to load ArgoCD accounts');
      setAccounts(data.data || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load ArgoCD accounts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, [orgId]);

  const openEdit = (a: ArgoAccount) => {
    setActive(a);
    setEditForm({
      name: a.name,
      url: a.url || '',
      token: '',
      insecure: Boolean(a.insecure),
      enabled: a.enabled,
    });
    setEditOpen(true);
  };

  const openDelete = (a: ArgoAccount) => {
    setActive(a);
    setDeleteOpen(true);
  };

  const createAccount = async () => {
    if (!orgId) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    if (!createForm.name || !createForm.url || !createForm.token) return toast.error('Name, URL, and token are required.');
    setBusyId('create');
    try {
      const res = await fetch('/api/integrations/argocd/accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-organization-id': orgId },
        body: JSON.stringify(createForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('ArgoCD account created.');
      setCreateOpen(false);
      setCreateForm({ name: '', url: '', token: '', insecure: false });
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create ArgoCD account');
    } finally {
      setBusyId(null);
    }
  };

  const updateAccount = async () => {
    if (!orgId || !active) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    if (!editForm.name || !editForm.url) return toast.error('Name and URL are required.');
    setBusyId(active.id);
    try {
      const payload: any = {
        name: editForm.name,
        url: editForm.url,
        enabled: editForm.enabled,
        insecure: editForm.insecure,
      };
      if (editForm.token) payload.token = editForm.token;

      const res = await fetch(`/api/integrations/argocd/accounts/${active.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-organization-id': orgId },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('ArgoCD account updated.');
      setEditOpen(false);
      setActive(null);
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update ArgoCD account');
    } finally {
      setBusyId(null);
    }
  };

  const deleteAccount = async () => {
    if (!orgId || !active) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    setBusyId(active.id);
    try {
      const res = await fetch(`/api/integrations/argocd/accounts/${active.id}`, {
        method: 'DELETE',
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('ArgoCD account deleted.');
      setDeleteOpen(false);
      setActive(null);
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete ArgoCD account');
    } finally {
      setBusyId(null);
    }
  };

  const toggleEnabled = async (a: ArgoAccount, enabled: boolean) => {
    if (!orgId) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/integrations/argocd/accounts/${a.id}`, {
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
          <h1 className="text-2xl font-bold tracking-tight">ArgoCD Configuration</h1>
          <p className="text-muted-foreground">Full CRUD for ArgoCD accounts and tokens.</p>
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
                  <TableHead>URL</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Insecure TLS</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                      No ArgoCD accounts yet.
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
                      <TableCell className="text-muted-foreground">
                        <span className="truncate block max-w-[420px]" title={a.url || ''}>
                          {a.url || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.hasToken ? 'Set' : 'Missing'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.insecure ? 'destructive' : 'outline'}>
                          {a.insecure ? 'On' : 'Off'}
                        </Badge>
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

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add ArgoCD account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} placeholder="prod" />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={createForm.url} onChange={(e) => setCreateForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://argocd.example.com" />
            </div>
            <div className="space-y-2">
              <Label>Token</Label>
              <Input value={createForm.token} onChange={(e) => setCreateForm((p) => ({ ...p, token: e.target.value }))} type="password" />
              <p className="text-xs text-muted-foreground">Stored encrypted. Not displayed again.</p>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Insecure TLS</p>
                <p className="text-xs text-muted-foreground">Only enable if your ArgoCD has self-signed certs.</p>
              </div>
              <Switch checked={createForm.insecure} onCheckedChange={(v) => setCreateForm((p) => ({ ...p, insecure: v }))} />
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
            <DialogTitle>Edit ArgoCD account</DialogTitle>
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
              <Label>Token (optional)</Label>
              <Input value={editForm.token} onChange={(e) => setEditForm((p) => ({ ...p, token: e.target.value }))} placeholder="Leave blank to keep existing" type="password" />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Insecure TLS</p>
                <p className="text-xs text-muted-foreground">If enabled, ArgoCD client can skip TLS verification.</p>
              </div>
              <Switch checked={editForm.insecure} onCheckedChange={(v) => setEditForm((p) => ({ ...p, insecure: v }))} />
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
            <DialogTitle>Delete ArgoCD account</DialogTitle>
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

