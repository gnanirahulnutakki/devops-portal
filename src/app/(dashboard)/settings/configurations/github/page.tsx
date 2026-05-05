'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { CredentialExpiryField } from '@/components/dashboard/credential-expiry-field';

type GitHubAccount = {
  id: string;
  name: string;
  enabled: boolean;
  organization?: string;
  hasToken?: boolean;
  updatedAt?: string;
  lastError?: string | null;
  expiresAt?: string | null;
};

export default function GitHubConfigurationsPage() {
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const orgId = currentOrganization?.id;
  const userIsAdmin = isAdmin(currentOrganization?.role);

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<GitHubAccount[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [active, setActive] = useState<GitHubAccount | null>(null);

  const [createForm, setCreateForm] = useState<{
    name: string; token: string; organization: string; expiresAt: string | null;
  }>({ name: '', token: '', organization: '', expiresAt: null });
  const [editForm, setEditForm] = useState<{
    name: string; token: string; organization: string; enabled: boolean; expiresAt: string | null;
  }>({ name: '', token: '', organization: '', enabled: true, expiresAt: null });
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/github/accounts', {
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to load GitHub accounts');
      setAccounts(data.data || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load GitHub accounts');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const openEdit = (a: GitHubAccount) => {
    setActive(a);
    setEditForm({
      name: a.name,
      token: '',
      organization: a.organization || '',
      enabled: a.enabled,
      expiresAt: a.expiresAt ?? null,
    });
    setEditOpen(true);
  };

  const openDelete = (a: GitHubAccount) => {
    setActive(a);
    setDeleteOpen(true);
  };

  const createAccount = async () => {
    if (!orgId) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    if (!createForm.name || !createForm.token) return toast.error('Name and token are required.');
    setBusyId('create');
    try {
      const res = await fetch('/api/integrations/github/accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-organization-id': orgId },
        body: JSON.stringify({
          name: createForm.name,
          token: createForm.token,
          organization: createForm.organization || undefined,
          expiresAt: createForm.expiresAt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('GitHub account created.');
      setCreateOpen(false);
      setCreateForm({ name: '', token: '', organization: '', expiresAt: null });
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create GitHub account');
    } finally {
      setBusyId(null);
    }
  };

  const updateAccount = async () => {
    if (!orgId || !active) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    if (!editForm.name) return toast.error('Name is required.');
    setBusyId(active.id);
    try {
      const payload: any = {
        name: editForm.name,
        enabled: editForm.enabled,
        organization: editForm.organization || undefined,
        expiresAt: editForm.expiresAt,
      };
      if (editForm.token) payload.token = editForm.token;

      const res = await fetch(`/api/integrations/github/accounts/${active.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-organization-id': orgId },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('GitHub account updated.');
      setEditOpen(false);
      setActive(null);
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update GitHub account');
    } finally {
      setBusyId(null);
    }
  };

  const deleteAccount = async () => {
    if (!orgId || !active) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    setBusyId(active.id);
    try {
      const res = await fetch(`/api/integrations/github/accounts/${active.id}`, {
        method: 'DELETE',
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Failed (HTTP ${res.status})`);
      toast.success('GitHub account deleted.');
      setDeleteOpen(false);
      setActive(null);
      await loadAccounts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete GitHub account');
    } finally {
      setBusyId(null);
    }
  };

  const toggleEnabled = async (a: GitHubAccount, enabled: boolean) => {
    if (!orgId) return;
    if (!userIsAdmin) return toast.error('Admin role required.');
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/integrations/github/accounts/${a.id}`, {
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
          <h1 className="text-2xl font-bold tracking-tight">GitHub Configuration</h1>
          <p className="text-muted-foreground">CRUD for GitHub tokens and defaults.</p>
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
                  <TableHead>Default org</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                      No GitHub accounts yet.
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
                      <TableCell className="text-muted-foreground">{a.organization || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.hasToken ? 'Set' : 'Missing'}</Badge>
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
            <DialogTitle>Add GitHub account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} placeholder="work" />
            </div>
            <div className="space-y-2">
              <Label>Token</Label>
              <Input value={createForm.token} onChange={(e) => setCreateForm((p) => ({ ...p, token: e.target.value }))} type="password" />
            </div>
            <div className="space-y-2">
              <Label>Default organization (optional)</Label>
              <Input value={createForm.organization} onChange={(e) => setCreateForm((p) => ({ ...p, organization: e.target.value }))} placeholder="my-github-org" />
            </div>
            <CredentialExpiryField
              id="github-create-expiry"
              value={createForm.expiresAt}
              onChange={(v) => setCreateForm((p) => ({ ...p, expiresAt: v }))}
            />
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
            <DialogTitle>Edit GitHub account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Token (optional)</Label>
              <Input value={editForm.token} onChange={(e) => setEditForm((p) => ({ ...p, token: e.target.value }))} placeholder="Leave blank to keep existing" type="password" />
            </div>
            <div className="space-y-2">
              <Label>Default organization (optional)</Label>
              <Input value={editForm.organization} onChange={(e) => setEditForm((p) => ({ ...p, organization: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Enabled</p>
                <p className="text-xs text-muted-foreground">Disable to temporarily hide this account.</p>
              </div>
              <Switch checked={editForm.enabled} onCheckedChange={(v) => setEditForm((p) => ({ ...p, enabled: v }))} />
            </div>
            <CredentialExpiryField
              id="github-edit-expiry"
              value={editForm.expiresAt}
              onChange={(v) => setEditForm((p) => ({ ...p, expiresAt: v }))}
            />
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
            <DialogTitle>Delete GitHub account</DialogTitle>
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

