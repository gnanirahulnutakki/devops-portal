'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Server,
  CheckCircle2,
  XCircle,
  FolderTree,
  Layers,
  Globe,
  FileCode2,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Search,
  Terminal,
  ChevronRight,
  Box,
  Activity,
  Shield,
  Key,
  Cloud,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthType = 'standard' | 'duplo' | 'eks';

interface ClusterItem {
  id: string;
  name: string;
  slug: string;
  provider: string;
  region: string;
  environment: string;
  status: string;
  authType: AuthType;
  hasKubeconfig: boolean;
  duploHost?: string;
  planId?: string;
  eksClusterName?: string;
  eksRegion?: string;
  eksEndpoint?: string;
}

interface OverviewData { version: string; nodes: number; namespaces: number; pods: number; }
interface NodeItem { name: string; status: string; version: string; cpu: string; memory: string; pods: string; age: string; }
interface NamespaceItem { name: string; pods: number; status: string; }
interface WorkloadItem { name: string; kind: string; status: string; namespace: string; }
interface ServiceItem { name: string; namespace: string; type: string; clusterIP: string; ports: string; }
interface IngressItem { name: string; namespace: string; className: string; hosts: string; }
interface CrdItem { name: string; scope: string; version: string; kind: string; }
interface PodItem { name: string; namespace: string; status: string; ready: string; restarts: number; age: string; containers: string[]; }

type TabKey = 'nodes' | 'namespaces' | 'workloads' | 'services' | 'pods' | 'ingresses' | 'crds';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'nodes', label: 'Nodes', icon: Server },
  { key: 'namespaces', label: 'Namespaces', icon: FolderTree },
  { key: 'workloads', label: 'Workloads', icon: Layers },
  { key: 'services', label: 'Services', icon: Globe },
  { key: 'pods', label: 'Pods', icon: Box },
  { key: 'ingresses', label: 'Ingresses', icon: Activity },
  { key: 'crds', label: 'CRDs', icon: FileCode2 },
];

function timeAgo(ts: string) {
  if (!ts) return '-';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function StatusDot({ status }: { status: string }) {
  const s = status?.toLowerCase();
  if (s === 'running' || s === 'ready' || s === 'active' || s === 'healthy')
    return <span className="inline-block h-2 w-2 rounded-full bg-green-500 shrink-0" />;
  if (s === 'pending' || s === 'progressing' || s === 'degraded')
    return <span className="inline-block h-2 w-2 rounded-full bg-yellow-500 shrink-0" />;
  if (s === 'failed' || s === 'error' || s === 'notready')
    return <span className="inline-block h-2 w-2 rounded-full bg-red-500 shrink-0" />;
  return <span className="inline-block h-2 w-2 rounded-full bg-gray-400 shrink-0" />;
}

const AUTH_TYPE_META: Record<AuthType, { label: string; icon: React.ElementType; desc: string }> = {
  standard: { label: 'Standard', icon: Key, desc: 'Token or certificate-based kubeconfig' },
  duplo: { label: 'Duplo JIT', icon: Shield, desc: 'DuploCloud API token — generates K8s tokens server-side' },
  eks: { label: 'AWS EKS', icon: Cloud, desc: 'AWS credentials — generates bearer tokens via STS presign' },
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ClustersPage() {
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);
  const orgId = currentOrganization?.id;

  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [namespaces, setNamespaces] = useState<NamespaceItem[]>([]);
  const [workloads, setWorkloads] = useState<WorkloadItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [ingresses, setIngresses] = useState<IngressItem[]>([]);
  const [crds, setCrds] = useState<CrdItem[]>([]);
  const [pods, setPods] = useState<PodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('nodes');
  const [filter, setFilter] = useState('');
  const [nsFilter, setNsFilter] = useState<string>('');
  const [logs, setLogs] = useState('');
  const [logPod, setLogPod] = useState<PodItem | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formValidation, setFormValidation] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [savingCluster, setSavingCluster] = useState(false);
  const [formError, setFormError] = useState('');

  const [form, setForm] = useState({
    id: '',
    name: '',
    slug: '',
    provider: 'aws',
    region: '',
    environment: 'production',
    authType: 'standard' as AuthType,
    // Standard
    kubeconfig: '',
    // Duplo
    duploHost: '',
    duploToken: '',
    planId: '',
    duploIsAdmin: true,
    // EKS
    eksClusterName: '',
    eksRegion: '',
    eksEndpoint: '',
    eksCaData: '',
    eksAccessKeyId: '',
    eksSecretAccessKey: '',
    eksRoleArn: '',
  });

  const selectedCluster = useMemo(() => clusters.find((c) => c.id === selectedId) || null, [clusters, selectedId]);

  // ─── Data fetching ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!orgId) return;
    fetch('/api/clusters', { headers: { 'x-organization-id': orgId } })
      .then((r) => r.json())
      .then((d) => {
        const list = d.data || [];
        setClusters(list);
        if (!selectedId && list[0]) setSelectedId(list[0].id);
      });
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshClusterData = useCallback(async () => {
    if (!orgId || !selectedId) return;
    setLoading(true);
    try {
      const h = { 'x-organization-id': orgId };
      const base = `/api/clusters/${selectedId}`;
      const [ov, nd, ns, wl, sv, ig, cr, pd] = await Promise.all([
        fetch(`${base}/overview`, { headers: h }).then((r) => r.json()),
        fetch(`${base}/nodes`, { headers: h }).then((r) => r.json()),
        fetch(`${base}/namespaces`, { headers: h }).then((r) => r.json()),
        fetch(`${base}/workloads`, { headers: h }).then((r) => r.json()),
        fetch(`${base}/services`, { headers: h }).then((r) => r.json()),
        fetch(`${base}/ingresses`, { headers: h }).then((r) => r.json()),
        fetch(`${base}/crds`, { headers: h }).then((r) => r.json()),
        fetch(`${base}/pods`, { headers: h }).then((r) => r.json()),
      ]);
      if (ov.data) setOverview(ov.data);
      setNodes(nd.data || []);
      setNamespaces(ns.data || []);
      setWorkloads(wl.data || []);
      setServices(sv.data || []);
      setIngresses(ig.data || []);
      setCrds(cr.data || []);
      setPods(pd.data || []);
    } finally {
      setLoading(false);
    }
  }, [orgId, selectedId]);

  useEffect(() => { refreshClusterData(); }, [refreshClusterData]);

  // ─── Test connection ────────────────────────────────────────────────────

  const testConnection = useCallback(async () => {
    if (!orgId) return;
    setFormValidation('running');
    setFormError('');

    let body: Record<string, any>;
    if (form.authType === 'standard') {
      if (!form.kubeconfig?.trim()) { setFormValidation('idle'); return; }
      body = { authType: 'standard', kubeconfig: form.kubeconfig };
    } else if (form.authType === 'duplo') {
      if (!form.duploHost || !form.duploToken || !form.planId) { setFormValidation('idle'); toast.error('Fill in all Duplo fields'); return; }
      body = { authType: 'duplo', duploHost: form.duploHost, duploToken: form.duploToken, planId: form.planId, isAdmin: form.duploIsAdmin };
    } else {
      if (!form.eksEndpoint || !form.eksAccessKeyId || !form.eksSecretAccessKey || !form.eksClusterName) { setFormValidation('idle'); toast.error('Fill in all EKS fields'); return; }
      body = { authType: 'eks', eksClusterName: form.eksClusterName, eksRegion: form.eksRegion, eksEndpoint: form.eksEndpoint, eksCaData: form.eksCaData, eksAccessKeyId: form.eksAccessKeyId, eksSecretAccessKey: form.eksSecretAccessKey, eksRoleArn: form.eksRoleArn || undefined };
    }

    try {
      const res = await fetch('/api/clusters/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-organization-id': orgId },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setFormValidation('success');
        toast.success(`Connected — ${data.data?.namespaces ?? 0} namespaces found`);
      } else {
        setFormValidation('error');
        setFormError(data?.error?.message || 'Connection failed');
        toast.error(data?.error?.message || 'Connection failed');
      }
    } catch (err) {
      setFormValidation('error');
      setFormError((err as Error).message);
    }
  }, [orgId, form]);

  // ─── Cluster CRUD ───────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({ id: '', name: '', slug: '', provider: 'aws', region: '', environment: 'production', authType: 'standard', kubeconfig: '', duploHost: '', duploToken: '', planId: '', duploIsAdmin: true, eksClusterName: '', eksRegion: '', eksEndpoint: '', eksCaData: '', eksAccessKeyId: '', eksSecretAccessKey: '', eksRoleArn: '' });
    setFormError('');
    setFormValidation('idle');
  };

  const openCreate = () => { resetForm(); setCreateOpen(true); };

  const openEdit = (c: ClusterItem) => {
    setForm({ id: c.id, name: c.name, slug: c.slug, provider: c.provider, region: c.region || '', environment: c.environment || 'production', authType: c.authType || 'standard', kubeconfig: '', duploHost: c.duploHost || '', duploToken: '', planId: c.planId || '', duploIsAdmin: true, eksClusterName: c.eksClusterName || '', eksRegion: c.eksRegion || '', eksEndpoint: c.eksEndpoint || '', eksCaData: '', eksAccessKeyId: '', eksSecretAccessKey: '', eksRoleArn: '' });
    setFormError('');
    setFormValidation('idle');
    setEditOpen(true);
  };

  const handleSave = async (isEdit: boolean) => {
    if (!orgId) return;
    if (!form.name || !form.slug) { setFormError('Name and slug are required.'); return; }
    if (form.authType === 'standard' && !isEdit && !form.kubeconfig) { setFormError('Kubeconfig is required.'); return; }
    if (form.authType === 'duplo' && (!form.duploHost || !form.duploToken || !form.planId)) { setFormError('All Duplo fields are required.'); return; }
    if (form.authType === 'eks' && (!form.eksEndpoint || !form.eksAccessKeyId || !form.eksSecretAccessKey || !form.eksClusterName)) { setFormError('All EKS fields are required.'); return; }

    setSavingCluster(true);
    setFormError('');

    const payload: Record<string, any> = {
      name: form.name, slug: form.slug, provider: form.provider, region: form.region, environment: form.environment, authType: form.authType,
    };

    if (form.authType === 'standard') {
      if (form.kubeconfig) payload.kubeconfig = form.kubeconfig;
    } else if (form.authType === 'duplo') {
      payload.duploHost = form.duploHost;
      if (form.duploToken) payload.duploToken = form.duploToken;
      payload.planId = form.planId;
      payload.duploIsAdmin = form.duploIsAdmin;
    } else if (form.authType === 'eks') {
      payload.eksClusterName = form.eksClusterName;
      payload.eksRegion = form.eksRegion;
      payload.eksEndpoint = form.eksEndpoint;
      if (form.eksCaData) payload.eksCaData = form.eksCaData;
      if (form.eksAccessKeyId) payload.eksAccessKeyId = form.eksAccessKeyId;
      if (form.eksSecretAccessKey) payload.eksSecretAccessKey = form.eksSecretAccessKey;
      if (form.eksRoleArn) payload.eksRoleArn = form.eksRoleArn;
    }

    const url = isEdit ? `/api/clusters/${form.id}` : '/api/clusters';
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'x-organization-id': orgId }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => null);

    if (res.ok) {
      if (isEdit) {
        setClusters((prev) => prev.map((c) => (c.id === form.id ? data.data : c)));
        setEditOpen(false);
      } else {
        setClusters((prev) => [data.data, ...prev]);
        setSelectedId(data.data.id);
        setCreateOpen(false);
      }
      toast.success(isEdit ? 'Cluster updated' : 'Cluster added');
      resetForm();
      refreshClusterData();
    } else {
      const msg = data?.error?.message || 'Failed';
      setFormError(msg);
      toast.error(msg);
    }
    setSavingCluster(false);
  };

  const handleDelete = async () => {
    if (!orgId || !selectedCluster) return;
    setSavingCluster(true);
    const res = await fetch(`/api/clusters/${selectedCluster.id}`, { method: 'DELETE', headers: { 'x-organization-id': orgId } });
    if (res.ok) {
      setClusters((prev) => {
        const rest = prev.filter((c) => c.id !== selectedCluster.id);
        setSelectedId(rest[0]?.id || null);
        return rest;
      });
      setDeleteOpen(false);
      toast.success('Cluster deleted');
    } else {
      toast.error('Failed to delete cluster');
    }
    setSavingCluster(false);
  };

  const loadKubeconfigFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((p) => ({ ...p, kubeconfig: String(reader.result || '') }));
    reader.readAsText(file);
  };

  const fetchPodLogs = async (pod: PodItem) => {
    if (!orgId || !selectedId) return;
    const res = await fetch(`/api/clusters/${selectedId}/pods/${pod.name}/logs?namespace=${pod.namespace}`, { headers: { 'x-organization-id': orgId } });
    const data = await res.json();
    if (res.ok) { setLogs(data.data?.logs || ''); setLogPod(pod); }
  };

  // ─── Filtering ──────────────────────────────────────────────────────────

  const q = filter.toLowerCase();
  const allNamespaces = useMemo(() => {
    const set = new Set<string>();
    pods.forEach((p) => set.add(p.namespace));
    workloads.forEach((w) => set.add(w.namespace));
    services.forEach((s) => set.add(s.namespace));
    return Array.from(set).sort();
  }, [pods, workloads, services]);

  const applyNsFilter = <T extends { namespace?: string; name?: string }>(items: T[]) => {
    let list = items;
    if (nsFilter) list = list.filter((i) => i.namespace === nsFilter);
    if (q) list = list.filter((i) => (i.name || '').toLowerCase().includes(q) || (i.namespace || '').toLowerCase().includes(q));
    return list;
  };

  const filteredNodes = useMemo(() => nodes.filter((n) => !q || n.name.toLowerCase().includes(q)), [nodes, q]);
  const filteredNamespaces = useMemo(() => namespaces.filter((n) => !q || n.name.toLowerCase().includes(q)), [namespaces, q]);
  const filteredWorkloads = useMemo(() => applyNsFilter(workloads), [workloads, q, nsFilter]); // eslint-disable-line
  const filteredServices = useMemo(() => applyNsFilter(services), [services, q, nsFilter]); // eslint-disable-line
  const filteredPods = useMemo(() => applyNsFilter(pods), [pods, q, nsFilter]); // eslint-disable-line
  const filteredIngresses = useMemo(() => applyNsFilter(ingresses), [ingresses, q, nsFilter]); // eslint-disable-line
  const filteredCrds = useMemo(() => crds.filter((c) => !q || c.name.toLowerCase().includes(q) || c.kind.toLowerCase().includes(q)), [crds, q]);

  // ─── Cluster form dialog ───────────────────────────────────────────────

  const ClusterFormBody = ({ isEdit }: { isEdit: boolean }) => {
    const atMeta = AUTH_TYPE_META[form.authType];
    return (
      <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
        {/* Name / Slug */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input className="h-8 text-sm" value={form.name} onChange={(e) => { const name = e.target.value; setForm((p) => ({ ...p, name, slug: p.id ? p.slug : name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') })); }} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Slug</Label>
            <Input className="h-8 text-sm" value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} />
          </div>
        </div>

        {/* Provider / Region / Env */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Provider</Label>
            <Select value={form.provider} onValueChange={(v) => setForm((p) => ({ ...p, provider: v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aws">AWS</SelectItem>
                <SelectItem value="gcp">GCP</SelectItem>
                <SelectItem value="azure">Azure</SelectItem>
                <SelectItem value="on-prem">On-Prem</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Region</Label>
            <Input className="h-8 text-sm" value={form.region} onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))} placeholder="us-west-2" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Environment</Label>
            <Select value={form.environment} onValueChange={(v) => setForm((p) => ({ ...p, environment: v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Auth Type Selector ── */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Authentication</Label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(AUTH_TYPE_META) as [AuthType, typeof atMeta][]).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => setForm((p) => ({ ...p, authType: key }))}
                className={`flex flex-col items-center gap-1 rounded-md border p-2.5 text-center transition-colors ${form.authType === key ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border hover:bg-accent/50'}`}
              >
                <meta.icon className="h-4 w-4" />
                <span className="text-xs font-medium">{meta.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">{atMeta.desc}</p>
        </div>

        {/* ── Standard: Kubeconfig ── */}
        {form.authType === 'standard' && (
          <div className="space-y-2 rounded-md border p-3">
            <Label className="text-xs">Kubeconfig {isEdit && <span className="text-muted-foreground">(leave blank to keep current)</span>}</Label>
            <Input type="file" className="h-8 text-xs" accept=".yaml,.yml" onChange={(e) => loadKubeconfigFile(e.target.files?.[0] || null)} />
            <Textarea className="text-xs font-mono" value={form.kubeconfig} onChange={(e) => setForm((p) => ({ ...p, kubeconfig: e.target.value }))} rows={4} placeholder="Paste kubeconfig YAML (must be token or cert-based, not exec)..." />
          </div>
        )}

        {/* ── Duplo JIT ── */}
        {form.authType === 'duplo' && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="space-y-1">
              <Label className="text-xs">Duplo Host</Label>
              <Input className="h-8 text-sm" value={form.duploHost} onChange={(e) => setForm((p) => ({ ...p, duploHost: e.target.value }))} placeholder="https://ops01.dc.radiantlogic.io" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">API Token {isEdit && <span className="text-muted-foreground">(leave blank to keep)</span>}</Label>
              <Input className="h-8 text-sm font-mono" type="password" value={form.duploToken} onChange={(e) => setForm((p) => ({ ...p, duploToken: e.target.value }))} placeholder="Permanent Duplo API token" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Plan ID / Tenant ID</Label>
                <Input className="h-8 text-sm" value={form.planId} onChange={(e) => setForm((p) => ({ ...p, planId: e.target.value }))} placeholder="rli-ops00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Access Level</Label>
                <Select value={form.duploIsAdmin ? 'admin' : 'tenant'} onValueChange={(v) => setForm((p) => ({ ...p, duploIsAdmin: v === 'admin' }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (plan-level)</SelectItem>
                    <SelectItem value="tenant">Tenant (tenant-level)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">The portal calls Duplo&apos;s REST API server-side to get a short-lived K8s token. No exec plugin needed.</p>
          </div>
        )}

        {/* ── EKS ── */}
        {form.authType === 'eks' && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cluster Name</Label>
                <Input className="h-8 text-sm" value={form.eksClusterName} onChange={(e) => setForm((p) => ({ ...p, eksClusterName: e.target.value }))} placeholder="my-eks-cluster" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Region</Label>
                <Input className="h-8 text-sm" value={form.eksRegion} onChange={(e) => setForm((p) => ({ ...p, eksRegion: e.target.value }))} placeholder="us-west-2" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">API Server Endpoint</Label>
              <Input className="h-8 text-sm font-mono" value={form.eksEndpoint} onChange={(e) => setForm((p) => ({ ...p, eksEndpoint: e.target.value }))} placeholder="https://XXXXXXXXX.gr7.us-west-2.eks.amazonaws.com" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Certificate Authority Data (base64)</Label>
              <Textarea className="text-xs font-mono" value={form.eksCaData} onChange={(e) => setForm((p) => ({ ...p, eksCaData: e.target.value }))} rows={2} placeholder="LS0tLS1CRUdJTi..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">AWS Access Key ID {isEdit && <span className="text-muted-foreground">(blank = keep)</span>}</Label>
                <Input className="h-8 text-sm font-mono" type="password" value={form.eksAccessKeyId} onChange={(e) => setForm((p) => ({ ...p, eksAccessKeyId: e.target.value }))} placeholder="AKIA..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Secret Access Key {isEdit && <span className="text-muted-foreground">(blank = keep)</span>}</Label>
                <Input className="h-8 text-sm font-mono" type="password" value={form.eksSecretAccessKey} onChange={(e) => setForm((p) => ({ ...p, eksSecretAccessKey: e.target.value }))} placeholder="wJalr..." />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role ARN <span className="text-muted-foreground">(optional)</span></Label>
              <Input className="h-8 text-sm font-mono" value={form.eksRoleArn} onChange={(e) => setForm((p) => ({ ...p, eksRoleArn: e.target.value }))} placeholder="arn:aws:iam::123456789:role/..." />
            </div>
            <p className="text-[10px] text-muted-foreground">The portal presigns an STS GetCallerIdentity request to generate EKS bearer tokens. The IAM user/role must be mapped in the EKS cluster&apos;s access configuration.</p>
          </div>
        )}

        {/* ── Test + Status ── */}
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={testConnection} disabled={formValidation === 'running'}>
            {formValidation === 'running' ? 'Testing...' : 'Test Connection'}
          </Button>
          {formValidation === 'success' && <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</Badge>}
          {formValidation === 'error' && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>}
        </div>
        {formError && <p className="text-xs text-destructive">{formError}</p>}
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  const hasCluster = clusters.length > 0;

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden -m-6">
      {/* ──── Left sidebar ──── */}
      <div className="w-56 shrink-0 border-r flex flex-col bg-muted/30">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clusters</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openCreate} title="Add cluster">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {clusters.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <Server className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">No clusters yet</p>
              <Button variant="link" size="sm" className="text-xs mt-1 h-auto p-0" onClick={openCreate}>
                Add your first cluster
              </Button>
            </div>
          ) : (
            clusters.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs border-b border-border/50 transition-colors ${selectedId === c.id ? 'bg-accent' : 'hover:bg-accent/50'}`}
              >
                <StatusDot status={c.status} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {c.provider} · {c.region || 'no region'}
                    {c.authType !== 'standard' && <> · <span className="text-primary">{AUTH_TYPE_META[c.authType]?.label}</span></>}
                  </p>
                </div>
                {selectedId === c.id && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
              </button>
            ))
          )}
        </div>

        {hasCluster && allNamespaces.length > 0 && (
          <div className="border-t px-2 py-2 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Namespace</span>
            <Select value={nsFilter} onValueChange={setNsFilter}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="All namespaces" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All namespaces</SelectItem>
                {allNamespaces.map((ns) => <SelectItem key={ns} value={ns}>{ns}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ──── Main content ──── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Cluster header */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-card shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {selectedCluster ? (
              <>
                <StatusDot status={selectedCluster.status} />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold truncate">{selectedCluster.name}</h2>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedCluster.provider} · {selectedCluster.region} · {selectedCluster.environment} · {overview?.version || '?'}
                    {selectedCluster.authType !== 'standard' && <> · <span className="text-primary font-medium">{AUTH_TYPE_META[selectedCluster.authType]?.label}</span></>}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select or add a cluster</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {selectedCluster && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refreshClusterData()} title="Refresh"><RefreshCcw className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(selectedCluster)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteOpen(true)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
              </>
            )}
            <div className="flex items-center gap-1 ml-2 text-[10px] text-muted-foreground">
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">{overview?.nodes ?? 0} nodes</Badge>
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">{overview?.namespaces ?? 0} ns</Badge>
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">{overview?.pods ?? 0} pods</Badge>
            </div>
          </div>
        </div>

        {/* Tabs + filter */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/20 shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors ${activeTab === t.key ? 'bg-accent font-medium' : 'hover:bg-accent/50 text-muted-foreground'}`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input className="h-7 text-xs pl-7 w-48" placeholder="Filter..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
        </div>

        {/* Table content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Loading...</div>
          ) : !selectedCluster ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Server className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Add a cluster to get started</p>
              <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Add Cluster</Button>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                {activeTab === 'nodes' && (
                  <tr className="border-b"><Th>Name</Th><Th>Status</Th><Th>Version</Th><Th>CPU</Th><Th>Memory</Th><Th>Pods</Th><Th>Age</Th></tr>
                )}
                {activeTab === 'namespaces' && (
                  <tr className="border-b"><Th>Name</Th><Th>Pods</Th><Th>Status</Th></tr>
                )}
                {activeTab === 'workloads' && (
                  <tr className="border-b"><Th>Name</Th><Th>Kind</Th><Th>Namespace</Th><Th>Status</Th></tr>
                )}
                {activeTab === 'services' && (
                  <tr className="border-b"><Th>Name</Th><Th>Type</Th><Th>Namespace</Th><Th>Cluster IP</Th><Th>Ports</Th></tr>
                )}
                {activeTab === 'pods' && (
                  <tr className="border-b"><Th>Name</Th><Th>Status</Th><Th>Ready</Th><Th>Restarts</Th><Th>Namespace</Th><Th>Age</Th><Th></Th></tr>
                )}
                {activeTab === 'ingresses' && (
                  <tr className="border-b"><Th>Name</Th><Th>Class</Th><Th>Hosts</Th><Th>Namespace</Th></tr>
                )}
                {activeTab === 'crds' && (
                  <tr className="border-b"><Th>Name</Th><Th>Kind</Th><Th>Scope</Th><Th>Version</Th></tr>
                )}
              </thead>
              <tbody>
                {activeTab === 'nodes' && filteredNodes.map((n) => (
                  <Tr key={n.name}><Td className="font-medium">{n.name}</Td><Td><StatusDot status={n.status} /> {n.status}</Td><Td>{n.version}</Td><Td>{n.cpu}</Td><Td>{n.memory}</Td><Td>{n.pods}</Td><Td>{timeAgo(n.age)}</Td></Tr>
                ))}
                {activeTab === 'namespaces' && filteredNamespaces.map((n) => (
                  <Tr key={n.name} className="cursor-pointer" onClick={() => { setNsFilter(n.name); setActiveTab('pods'); }}><Td className="font-medium">{n.name}</Td><Td>{n.pods}</Td><Td><StatusDot status={n.status} /> {n.status}</Td></Tr>
                ))}
                {activeTab === 'workloads' && filteredWorkloads.map((w) => (
                  <Tr key={`${w.namespace}-${w.name}`}><Td className="font-medium">{w.name}</Td><Td><Badge variant="outline" className="text-[10px] h-4 px-1">{w.kind}</Badge></Td><Td>{w.namespace}</Td><Td><StatusDot status={w.status} /> {w.status}</Td></Tr>
                ))}
                {activeTab === 'services' && filteredServices.map((s) => (
                  <Tr key={`${s.namespace}-${s.name}`}><Td className="font-medium">{s.name}</Td><Td><Badge variant="outline" className="text-[10px] h-4 px-1">{s.type}</Badge></Td><Td>{s.namespace}</Td><Td className="font-mono">{s.clusterIP}</Td><Td className="font-mono">{s.ports}</Td></Tr>
                ))}
                {activeTab === 'pods' && filteredPods.map((p) => (
                  <Tr key={`${p.namespace}-${p.name}`}>
                    <Td className="font-medium">{p.name}</Td>
                    <Td><StatusDot status={p.status} /> {p.status}</Td>
                    <Td>{p.ready}</Td>
                    <Td className={p.restarts > 5 ? 'text-destructive font-medium' : ''}>{p.restarts}</Td>
                    <Td>{p.namespace}</Td>
                    <Td>{timeAgo(p.age)}</Td>
                    <Td><button className="hover:text-primary" onClick={() => fetchPodLogs(p)} title="View logs"><Terminal className="h-3.5 w-3.5" /></button></Td>
                  </Tr>
                ))}
                {activeTab === 'ingresses' && filteredIngresses.map((i) => (
                  <Tr key={`${i.namespace}-${i.name}`}><Td className="font-medium">{i.name}</Td><Td>{i.className}</Td><Td className="font-mono">{i.hosts}</Td><Td>{i.namespace}</Td></Tr>
                ))}
                {activeTab === 'crds' && filteredCrds.map((c) => (
                  <Tr key={c.name}><Td className="font-mono text-[10px]">{c.name}</Td><Td>{c.kind}</Td><Td>{c.scope}</Td><Td>{c.version}</Td></Tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ──── Dialogs ──── */}

      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Add Cluster</DialogTitle>
            <DialogDescription className="text-xs">Connect a Kubernetes cluster. Choose the auth method that matches your setup.</DialogDescription>
          </DialogHeader>
          <ClusterFormBody isEdit={false} />
          <Button size="sm" onClick={() => handleSave(false)} disabled={savingCluster}>{savingCluster ? 'Saving...' : 'Save Cluster'}</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Cluster</DialogTitle>
            <DialogDescription className="text-xs">Update metadata or credentials. Secret fields left blank will keep their current values.</DialogDescription>
          </DialogHeader>
          <ClusterFormBody isEdit={true} />
          <Button size="sm" onClick={() => handleSave(true)} disabled={savingCluster}>{savingCluster ? 'Saving...' : 'Save Changes'}</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Delete Cluster</DialogTitle>
            <DialogDescription className="text-xs">This removes the cluster from the portal. No Kubernetes resources will be deleted.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={savingCluster}>{savingCluster ? 'Deleting...' : 'Delete'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(logPod)} onOpenChange={(o) => { if (!o) { setLogPod(null); setLogs(''); } }}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-mono">{logPod?.name}</DialogTitle>
            <DialogDescription className="text-xs">{logPod?.namespace}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded border bg-black p-3">
            <pre className="text-[11px] text-green-400 font-mono whitespace-pre-wrap">{logs || 'No logs.'}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Table primitives ─────────────────────────────────────────────────────────

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${className || ''}`}>{children}</th>;
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-1.5 ${className || ''}`}>{children}</td>;
}

function Tr({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return <tr className={`border-b border-border/30 hover:bg-accent/30 transition-colors ${className || ''}`} onClick={onClick}>{children}</tr>;
}
