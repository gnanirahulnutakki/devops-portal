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

type SupabaseAccount = {
  id: string;
  name: string;
  enabled: boolean;
  url?: string;
  hasAnonKey?: boolean;
  hasServiceRoleKey?: boolean;
  lastError?: string | null;
};

export default function SupabaseConfigurationsPage() {
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const orgId = currentOrganization?.id;
  const userIsAdmin = isAdmin(currentOrganization?.role);

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<SupabaseAccount[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [active, setActive] = useState<SupabaseAccount | null>(null);

  const [createForm, setCreateForm] = useState({
    name: '',
    url: '',
    anonKey: '',
    serviceRoleKey: '',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    url: '',
    anonKey: '',
    serviceRoleKey: '',
    enabled: true,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadAccounts() {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/supabase/accounts', {
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to load Supabase accounts');
      setAccounts(data.data || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load Supabase accounts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, [orgId]);

  const openEdit = (a: SupabaseAccount) => {
    setActive(a);
    setEditForm({
      name: a.name,
      url: a.url || '',
      anonKey: '',
      serviceRoleKey: '',
      enabled: a.enabled,
    });
    setEditOpen(true);
  };

  const openDelete = (a: SupabaseAccount) => {
    setActive(a);
    setDeleteOpen(true);
  };

  const createAccount = async () => {
    if (!orgId) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    if (!createForm.name || !createForm.url) return toast.error('Name and URL are required.');
    if (!createForm.anonKey && !createForm.serviceRoleKey) return toast.error('anonKey or serviceRoleKey is required.');
    setBusyId('create');
    try {
      const res = await fetch('/api/integrations/supabase/accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-organization-id': orgId },
        body: JSON.stringify({
          name: createForm.name,
          url: createForm.url,
          ...(createForm.anonKey ? { anonKey: createForm.anonKey } : {}),
          ...(createForm.serviceRoleKey ? { serviceRoleKey: createForm.serviceRoleKey } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('Supabase account created.');
      setCreateOpen(false);
      setCreateForm({ name: '', url: '', anonKey: '', serviceRoleKey: '' });
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create Supabase account');
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
      };
      if (editForm.anonKey) payload.anonKey = editForm.anonKey;
      if (editForm.serviceRoleKey) payload.serviceRoleKey = editForm.serviceRoleKey;

      const res = await fetch(`/api/integrations/supabase/accounts/${active.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-organization-id': orgId },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('Supabase account updated.');
      setEditOpen(false);
      setActive(null);
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update Supabase account');
    } finally {
      setBusyId(null);
    }
  };

  const deleteAccount = async () => {
    if (!orgId || !active) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    setBusyId(active.id);
    try {
      const res = await fetch(`/api/integrations/supabase/accounts/${active.id}`, {
        method: 'DELETE',
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('Supabase account deleted.');
      setDeleteOpen(false);
      setActive(null);
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete Supabase account');
    } finally {
      setBusyId(null);
    }
  };

  const toggleEnabled = async (a: SupabaseAccount, enabled: boolean) => {
    if (!orgId) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/integrations/supabase/accounts/${a.id}`, {
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
          <h1 className="text-2xl font-bold tracking-tight">Supabase Configuration</h1>
          <p className="text-muted-foreground">CRUD for Supabase accounts (URL + keys).</p>
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
                  <TableHead>Keys</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                      No Supabase accounts yet.
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
                      <TableCell className="text-muted-foreground">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{a.hasAnonKey ? 'anonKey' : 'no anonKey'}</Badge>
                          <Badge variant="secondary">{a.hasServiceRoleKey ? 'serviceRoleKey' : 'no serviceRoleKey'}</Badge>
                        </div>
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
            <DialogTitle>Add Supabase account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={createForm.url} onChange={(e) => setCreateForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://xyz.supabase.co" />
            </div>
            <div className="space-y-2">
              <Label>anonKey (optional)</Label>
              <Input value={createForm.anonKey} onChange={(e) => setCreateForm((p) => ({ ...p, anonKey: e.target.value }))} type="password" />
            </div>
            <div className="space-y-2">
              <Label>serviceRoleKey (optional)</Label>
              <Input value={createForm.serviceRoleKey} onChange={(e) => setCreateForm((p) => ({ ...p, serviceRoleKey: e.target.value }))} type="password" />
              <p className="text-xs text-muted-foreground">At least one key is required.</p>
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
            <DialogTitle>Edit Supabase account</DialogTitle>
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
              <Label>anonKey (optional)</Label>
              <Input value={editForm.anonKey} onChange={(e) => setEditForm((p) => ({ ...p, anonKey: e.target.value }))} placeholder="Leave blank to keep existing" type="password" />
            </div>
            <div className="space-y-2">
              <Label>serviceRoleKey (optional)</Label>
              <Input value={editForm.serviceRoleKey} onChange={(e) => setEditForm((p) => ({ ...p, serviceRoleKey: e.target.value }))} placeholder="Leave blank to keep existing" type="password" />
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
            <DialogTitle>Delete Supabase account</DialogTitle>
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

