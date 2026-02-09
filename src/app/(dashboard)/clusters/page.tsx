'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  MemoryStick,
  Boxes,
  FolderTree,
  Layers,
  ShieldCheck,
  Plus,
  FileText,
} from 'lucide-react';

interface ClusterItem {
  id: string;
  name: string;
  slug: string;
  provider: string;
  region: string;
  environment: string;
  status: string;
  hasKubeconfig: boolean;
  jitUrl?: string;
}

interface OverviewData {
  version: string;
  nodes: number;
  namespaces: number;
  pods: number;
}

interface NodeItem {
  name: string;
  status: string;
  version: string;
  cpu: string;
  memory: string;
  pods: string;
  age: string;
}

interface NamespaceItem {
  name: string;
  pods: number;
  status: string;
}

interface WorkloadItem {
  name: string;
  kind: string;
  status: string;
  namespace: string;
}

interface ServiceItem {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: string;
}

interface IngressItem {
  name: string;
  namespace: string;
  className: string;
  hosts: string;
}

interface CrdItem {
  name: string;
  scope: string;
  version: string;
  kind: string;
}

interface PodItem {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
  containers: string[];
}

const DEFAULT_DUPLO_JIT_TEMPLATE =
  'https://dev01.dc.radiantlogic.io/app/user/verify-token?localAppName=duplo-jit&localPort=53611&isAdmin=true&success=true';

const getDuploJitTemplate = (override?: string) =>
  override || process.env.NEXT_PUBLIC_DUPLO_JIT_TEMPLATE_URL || DEFAULT_DUPLO_JIT_TEMPLATE;

const isDuploKubeconfig = (kubeconfig?: string) => {
  if (!kubeconfig) return false;
  const text = kubeconfig.toLowerCase();
  return text.includes('duplo') || text.includes('duploinfra') || text.includes('duploservices');
};

export default function ClustersPage() {
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);
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
  const [logs, setLogs] = useState('');
  const [logPod, setLogPod] = useState<PodItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createValidation, setCreateValidation] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState('');
  const [editValidation, setEditValidation] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingCluster, setDeletingCluster] = useState(false);
  const [duploTemplateUrl, setDuploTemplateUrl] = useState<string>('');

  const [newCluster, setNewCluster] = useState({
    name: '',
    slug: '',
    provider: 'aws',
    region: '',
    environment: 'production',
    kubeconfig: '',
    jitUrl: '',
  });
  const [editCluster, setEditCluster] = useState({
    id: '',
    name: '',
    slug: '',
    provider: 'aws',
    region: '',
    environment: 'production',
    kubeconfig: '',
    jitUrl: '',
  });
  const [savingCluster, setSavingCluster] = useState(false);

  const orgId = currentOrganization?.id;

  const selectedCluster = useMemo(
    () => clusters.find((c) => c.id === selectedId) || null,
    [clusters, selectedId]
  );

  const healthyCount = clusters.filter((c) => c.status === 'HEALTHY').length;
  const warningCount = clusters.filter((c) => c.status === 'DEGRADED').length;
  const totalNodes = overview?.nodes ?? 0;
  const demoMode = clusters.length === 0 || !clusters.some((c) => c.hasKubeconfig);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Healthy</Badge>;
      case 'DEGRADED':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Warning</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const ProgressBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
    </div>
  );

  const openEditDialog = (cluster: ClusterItem) => {
    setEditCluster({
      id: cluster.id,
      name: cluster.name,
      slug: cluster.slug,
      provider: cluster.provider,
      region: cluster.region || '',
      environment: cluster.environment || 'production',
      kubeconfig: '',
      jitUrl: cluster.jitUrl || '',
    });
    setEditError('');
    setEditValidation('idle');
    setEditOpen(true);
  };

  const testKubeconfig = async (kubeconfig: string, setStatus: (value: any) => void) => {
    if (!orgId || !kubeconfig?.trim()) return;
    setStatus('running');
    const res = await fetch('/api/clusters/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-organization-id': orgId },
      body: JSON.stringify({ kubeconfig }),
    });
    if (res.ok) {
      setStatus('success');
      toast.success('Kubeconfig validated successfully');
    } else {
      setStatus('error');
      const data = await res.json();
      toast.error(data?.error?.message || 'Kubeconfig validation failed');
      if (isDuploKubeconfig(kubeconfig)) {
        window.open(getDuploJitTemplate(duploTemplateUrl), '_blank', 'noopener,noreferrer');
      }
    }
  };

  useEffect(() => {
    if (!orgId) return;
    const fetchSettings = async () => {
      const res = await fetch('/api/organizations/settings', {
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json();
      if (res.ok) {
        setDuploTemplateUrl(data.data?.duplo?.jitTemplateUrl || '');
      }
    };
    const fetchClusters = async () => {
      const res = await fetch('/api/clusters', {
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json();
      if (res.ok) {
        setClusters(data.data || []);
        if (!selectedId && data.data?.[0]) {
          setSelectedId(data.data[0].id);
        }
      }
    };
    fetchSettings();
    fetchClusters();
  }, [orgId, selectedId]);

  useEffect(() => {
    if (!orgId || !selectedId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [overviewRes, nodesRes, nsRes, workloadsRes, servicesRes, ingressRes, crdsRes, podsRes] =
          await Promise.all([
            fetch(`/api/clusters/${selectedId}/overview`, { headers: { 'x-organization-id': orgId } }),
            fetch(`/api/clusters/${selectedId}/nodes`, { headers: { 'x-organization-id': orgId } }),
            fetch(`/api/clusters/${selectedId}/namespaces`, { headers: { 'x-organization-id': orgId } }),
            fetch(`/api/clusters/${selectedId}/workloads`, { headers: { 'x-organization-id': orgId } }),
            fetch(`/api/clusters/${selectedId}/services`, { headers: { 'x-organization-id': orgId } }),
            fetch(`/api/clusters/${selectedId}/ingresses`, { headers: { 'x-organization-id': orgId } }),
            fetch(`/api/clusters/${selectedId}/crds`, { headers: { 'x-organization-id': orgId } }),
            fetch(`/api/clusters/${selectedId}/pods`, { headers: { 'x-organization-id': orgId } }),
          ]);

        const overviewData = await overviewRes.json();
        const nodesData = await nodesRes.json();
        const nsData = await nsRes.json();
        const workloadsData = await workloadsRes.json();
        const servicesData = await servicesRes.json();
        const ingressData = await ingressRes.json();
        const crdData = await crdsRes.json();
        const podsData = await podsRes.json();

        if (overviewRes.ok) setOverview(overviewData.data);
        if (nodesRes.ok) setNodes(nodesData.data || []);
        if (nsRes.ok) setNamespaces(nsData.data || []);
        if (workloadsRes.ok) setWorkloads(workloadsData.data || []);
        if (servicesRes.ok) setServices(servicesData.data || []);
        if (ingressRes.ok) setIngresses(ingressData.data || []);
        if (crdsRes.ok) setCrds(crdData.data || []);
        if (podsRes.ok) setPods(podsData.data || []);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orgId, selectedId]);

  const handleCreateCluster = async () => {
    if (!orgId) return;
    if (!newCluster.name || !newCluster.slug || !newCluster.kubeconfig) {
      setCreateError('Name, slug, and kubeconfig are required.');
      toast.error('Please fill all required fields.');
      return;
    }
    setSavingCluster(true);
    setCreateError('');
    const cleanedJitUrl = newCluster.jitUrl?.trim() || undefined;
    const payload = {
      ...newCluster,
      jitUrl:
        cleanedJitUrl || (isDuploKubeconfig(newCluster.kubeconfig) ? getDuploJitTemplate(duploTemplateUrl) : undefined),
    };
    const res = await fetch('/api/clusters', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-organization-id': orgId,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      const shouldPromptJit =
        !cleanedJitUrl && isDuploKubeconfig(payload.kubeconfig) && Boolean(getDuploJitTemplate(duploTemplateUrl));
      setNewCluster({
        name: '',
        slug: '',
        provider: 'aws',
        region: '',
        environment: 'production',
        kubeconfig: '',
        jitUrl: '',
      });
      setCreateValidation('idle');
      if (data?.data) {
        setClusters((prev) => [data.data, ...prev]);
        setSelectedId(data.data.id);
      }
      setCreateOpen(false);
      toast.success('Cluster added');
      if (shouldPromptJit) {
        const confirmOpen = window.confirm(
          'Duplo JIT approval is required for this kubeconfig. Open the JIT approval page now?'
        );
        if (confirmOpen) {
          window.open(getDuploJitTemplate(duploTemplateUrl), '_blank', 'noopener,noreferrer');
        }
      }
    } else {
      const message = data?.error?.message || 'Failed to add cluster';
      setCreateError(message);
      toast.error(message);
    }
    setSavingCluster(false);
  };

  const handleUpdateCluster = async () => {
    if (!orgId || !editCluster.id) return;
    if (!editCluster.name || !editCluster.slug) {
      setEditError('Name and slug are required.');
      return;
    }
    setSavingCluster(true);
    setEditError('');
    const cleanedJitUrl = editCluster.jitUrl?.trim() || undefined;
    const payload = {
      name: editCluster.name,
      slug: editCluster.slug,
      provider: editCluster.provider,
      region: editCluster.region,
      environment: editCluster.environment,
      kubeconfig: editCluster.kubeconfig || undefined,
      jitUrl:
        cleanedJitUrl || (isDuploKubeconfig(editCluster.kubeconfig) ? getDuploJitTemplate(duploTemplateUrl) : undefined),
    };
    const res = await fetch(`/api/clusters/${editCluster.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-organization-id': orgId,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setClusters((prev) => prev.map((item) => (item.id === editCluster.id ? data.data : item)));
      setEditOpen(false);
      toast.success('Cluster updated');
    } else {
      const message = data?.error?.message || 'Failed to update cluster';
      setEditError(message);
      toast.error(message);
    }
    setSavingCluster(false);
  };

  const handleDeleteCluster = async () => {
    if (!orgId || !selectedCluster) return;
    setDeletingCluster(true);
    const res = await fetch(`/api/clusters/${selectedCluster.id}`, {
      method: 'DELETE',
      headers: { 'x-organization-id': orgId },
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setClusters((prev) => {
        const remaining = prev.filter((item) => item.id !== selectedCluster.id);
        setSelectedId((current) => {
          if (current !== selectedCluster.id) return current;
          return remaining[0]?.id || null;
        });
        return remaining;
      });
      setDeleteOpen(false);
      toast.success('Cluster deleted');
    } else {
      toast.error(data?.error?.message || 'Failed to delete cluster');
    }
    setDeletingCluster(false);
  };

  const loadKubeconfigFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setNewCluster((prev) => ({ ...prev, kubeconfig: String(reader.result || '') }));
    };
    reader.readAsText(file);
  };

  const loadEditKubeconfigFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditCluster((prev) => ({ ...prev, kubeconfig: String(reader.result || '') }));
    };
    reader.readAsText(file);
  };

  const fetchPodLogs = async (pod: PodItem) => {
    if (!orgId || !selectedId) return;
    const res = await fetch(
      `/api/clusters/${selectedId}/pods/${pod.name}/logs?namespace=${pod.namespace}`,
      { headers: { 'x-organization-id': orgId } }
    );
    const data = await res.json();
    if (res.ok) {
      setLogs(data.data?.logs || '');
      setLogPod(pod);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clusters</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Lens-style Kubernetes view across clusters, nodes, and workloads.
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {demoMode && (
          <Alert className="flex-1">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Demo Mode</AlertTitle>
            <AlertDescription>
              Upload a kubeconfig to see real cluster data.
            </AlertDescription>
          </Alert>
        )}
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) {
              setCreateError('');
              setCreateValidation('idle');
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Cluster
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Kubernetes Cluster</DialogTitle>
              <DialogDescription>
                Upload a kubeconfig file to enable Lens-style browsing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={newCluster.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewCluster((prev) => ({
                      ...prev,
                      name,
                      slug: name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''),
                    }));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Slug</Label>
                <Input
                  value={newCluster.slug}
                  onChange={(e) => setNewCluster((prev) => ({ ...prev, slug: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Provider</Label>
                <Select
                  value={newCluster.provider}
                  onValueChange={(value) => setNewCluster((prev) => ({ ...prev, provider: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="gcp">GCP</SelectItem>
                    <SelectItem value="azure">Azure</SelectItem>
                    <SelectItem value="on-prem">On-Prem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Region (optional)</Label>
                <Input
                  value={newCluster.region}
                  onChange={(e) => setNewCluster((prev) => ({ ...prev, region: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Environment</Label>
                <Select
                  value={newCluster.environment}
                  onValueChange={(value) => setNewCluster((prev) => ({ ...prev, environment: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Duplo JIT URL (optional)</Label>
                <Input
                  value={newCluster.jitUrl}
                  onChange={(e) => setNewCluster((prev) => ({ ...prev, jitUrl: e.target.value }))}
                  placeholder="https://<duplo-host>/..."
                />
              </div>
              <div className="space-y-1">
                <Label>Kubeconfig File</Label>
                <Input type="file" onChange={(e) => loadKubeconfigFile(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-1">
                <Label>Kubeconfig</Label>
                <Textarea
                  value={newCluster.kubeconfig}
                  onChange={(e) => setNewCluster((prev) => ({ ...prev, kubeconfig: e.target.value }))}
                  rows={6}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => testKubeconfig(newCluster.kubeconfig, setCreateValidation)}
                  disabled={createValidation === 'running' || !newCluster.kubeconfig}
                >
                  {createValidation === 'running' ? 'Testing...' : 'Test Connection'}
                </Button>
                {createValidation === 'success' ? (
                  <Badge variant="secondary">Connection OK</Badge>
                ) : createValidation === 'error' ? (
                  <Badge variant="outline">Failed</Badge>
                ) : null}
              </div>
              <Button onClick={handleCreateCluster} disabled={savingCluster}>
                {savingCluster ? 'Saving...' : 'Save Cluster'}
              </Button>
              {createError ? <p className="text-sm text-red-500">{createError}</p> : null}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) {
              setEditError('');
              setEditValidation('idle');
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Cluster</DialogTitle>
              <DialogDescription>Update cluster metadata or replace kubeconfig.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={editCluster.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setEditCluster((prev) => ({
                      ...prev,
                      name,
                      slug: prev.slug || name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''),
                    }));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Slug</Label>
                <Input
                  value={editCluster.slug}
                  onChange={(e) => setEditCluster((prev) => ({ ...prev, slug: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Provider</Label>
                <Select
                  value={editCluster.provider}
                  onValueChange={(value) => setEditCluster((prev) => ({ ...prev, provider: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="gcp">GCP</SelectItem>
                    <SelectItem value="azure">Azure</SelectItem>
                    <SelectItem value="on-prem">On-Prem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Region (optional)</Label>
                <Input
                  value={editCluster.region}
                  onChange={(e) => setEditCluster((prev) => ({ ...prev, region: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Environment</Label>
                <Select
                  value={editCluster.environment}
                  onValueChange={(value) => setEditCluster((prev) => ({ ...prev, environment: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Duplo JIT URL (optional)</Label>
                <Input
                  value={editCluster.jitUrl}
                  onChange={(e) => setEditCluster((prev) => ({ ...prev, jitUrl: e.target.value }))}
                  placeholder="https://<duplo-host>/..."
                />
              </div>
              <div className="space-y-1">
                <Label>Replace Kubeconfig (optional)</Label>
                <Input type="file" onChange={(e) => loadEditKubeconfigFile(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-1">
                <Label>Kubeconfig</Label>
                <Textarea
                  value={editCluster.kubeconfig}
                  onChange={(e) => setEditCluster((prev) => ({ ...prev, kubeconfig: e.target.value }))}
                  rows={5}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => testKubeconfig(editCluster.kubeconfig, setEditValidation)}
                  disabled={editValidation === 'running' || !editCluster.kubeconfig}
                >
                  {editValidation === 'running' ? 'Testing...' : 'Test Connection'}
                </Button>
                {editValidation === 'success' ? (
                  <Badge variant="secondary">Connection OK</Badge>
                ) : editValidation === 'error' ? (
                  <Badge variant="outline">Failed</Badge>
                ) : null}
              </div>
              <Button onClick={handleUpdateCluster} disabled={savingCluster}>
                {savingCluster ? 'Saving...' : 'Save Changes'}
              </Button>
              {editError ? <p className="text-sm text-red-500">{editError}</p> : null}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Cluster</DialogTitle>
              <DialogDescription>
                This will remove the cluster from the portal. It does not delete any Kubernetes resources.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteCluster} disabled={deletingCluster}>
                {deletingCluster ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Clusters</CardDescription>
            <CardTitle className="text-2xl">{clusters.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Healthy
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">{healthyCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Warning
            </CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{warningCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Nodes</CardDescription>
            <CardTitle className="text-2xl">{totalNodes}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Clusters
            </CardTitle>
            <CardDescription>Select a cluster</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {clusters.map((cluster) => (
              <button
                key={cluster.id}
                onClick={() => setSelectedId(cluster.id)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  selectedId === cluster.id ? 'border-primary bg-muted' : 'hover:bg-muted/50'
                }`}
              >
                <div>
                  <p className="font-medium">{cluster.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cluster.provider} • {cluster.region}
                  </p>
                </div>
                {getStatusBadge(cluster.status)}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{selectedCluster?.name || 'Select a cluster'}</CardTitle>
              <CardDescription>
                {selectedCluster?.provider} • {selectedCluster?.region} • {overview?.version || 'unknown'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {selectedCluster?.jitUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(selectedCluster.jitUrl as string, '_blank', 'noopener,noreferrer')}
                >
                  Open Duplo JIT
                </Button>
              ) : null}
              {selectedCluster ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedCluster)}>
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                    Delete
                  </Button>
                </>
              ) : null}
              {selectedCluster && getStatusBadge(selectedCluster.status)}
              <Badge variant="outline">{overview?.nodes ?? 0} nodes</Badge>
              <Badge variant="outline">{overview?.pods ?? 0} pods</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Cpu className="h-4 w-4" />
                    CPU
                  </span>
                  <span>{loading ? '...' : '-'}</span>
                </div>
                <ProgressBar
                  value={0}
                  max={100}
                  color="bg-green-500"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MemoryStick className="h-4 w-4" />
                    Memory
                  </span>
                  <span>{loading ? '...' : '-'}</span>
                </div>
                <ProgressBar
                  value={0}
                  max={100}
                  color="bg-green-500"
                />
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex flex-wrap gap-2 h-auto w-full justify-start">
                <TabsTrigger value="overview" className="gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="nodes" className="gap-2">
                  <Server className="h-4 w-4" />
                  Nodes
                </TabsTrigger>
                <TabsTrigger value="namespaces" className="gap-2">
                  <FolderTree className="h-4 w-4" />
                  Namespaces
                </TabsTrigger>
                <TabsTrigger value="workloads" className="gap-2">
                  <Layers className="h-4 w-4" />
                  Workloads
                </TabsTrigger>
                <TabsTrigger value="services" className="gap-2">
                  <Boxes className="h-4 w-4" />
                  Services
                </TabsTrigger>
                <TabsTrigger value="pods" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Pods
                </TabsTrigger>
                <TabsTrigger value="ingresses" className="gap-2">
                  <Boxes className="h-4 w-4" />
                  Ingresses
                </TabsTrigger>
                <TabsTrigger value="crds" className="gap-2">
                  <Boxes className="h-4 w-4" />
                  CRDs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Nodes</CardDescription>
                      <CardTitle className="text-2xl">{overview?.nodes ?? 0}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Namespaces</CardDescription>
                      <CardTitle className="text-2xl">{overview?.namespaces ?? 0}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Workloads</CardDescription>
                      <CardTitle className="text-2xl">{workloads.length}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="nodes" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>CPU</TableHead>
                      <TableHead>Memory</TableHead>
                      <TableHead>Pods</TableHead>
                      <TableHead>Age</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nodes.map((node) => (
                      <TableRow key={node.name}>
                        <TableCell className="font-medium">{node.name}</TableCell>
                        <TableCell>{node.status}</TableCell>
                        <TableCell>{node.cpu}</TableCell>
                        <TableCell>{node.memory}</TableCell>
                        <TableCell>{node.pods}</TableCell>
                        <TableCell>{node.age}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="namespaces" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Pods</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {namespaces.map((ns) => (
                      <TableRow key={ns.name}>
                        <TableCell className="font-medium">{ns.name}</TableCell>
                        <TableCell>{ns.pods}</TableCell>
                        <TableCell>{ns.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="workloads" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Namespace</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workloads.map((workload) => (
                      <TableRow key={`${workload.namespace}-${workload.name}`}>
                        <TableCell className="font-medium">{workload.name}</TableCell>
                        <TableCell>{workload.kind}</TableCell>
                        <TableCell>{workload.status}</TableCell>
                        <TableCell>{workload.namespace}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="services" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Namespace</TableHead>
                      <TableHead>Endpoints</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((service) => (
                      <TableRow key={`${service.namespace}-${service.name}`}>
                        <TableCell className="font-medium">{service.name}</TableCell>
                        <TableCell>{service.type}</TableCell>
                        <TableCell>{service.namespace}</TableCell>
                        <TableCell>{service.ports}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="pods" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ready</TableHead>
                      <TableHead>Restarts</TableHead>
                      <TableHead>Namespace</TableHead>
                      <TableHead>Logs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pods.map((pod) => (
                      <TableRow key={`${pod.namespace}-${pod.name}`}>
                        <TableCell className="font-medium">{pod.name}</TableCell>
                        <TableCell>{pod.status}</TableCell>
                        <TableCell>{pod.ready}</TableCell>
                        <TableCell>{pod.restarts}</TableCell>
                        <TableCell>{pod.namespace}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => fetchPodLogs(pod)}>
                            Logs
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="ingresses" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Hosts</TableHead>
                      <TableHead>Namespace</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingresses.map((ingress) => (
                      <TableRow key={`${ingress.namespace}-${ingress.name}`}>
                        <TableCell className="font-medium">{ingress.name}</TableCell>
                        <TableCell>{ingress.className}</TableCell>
                        <TableCell>{ingress.hosts}</TableCell>
                        <TableCell>{ingress.namespace}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="crds" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Version</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {crds.map((crd) => (
                      <TableRow key={crd.name}>
                        <TableCell className="font-medium">{crd.name}</TableCell>
                        <TableCell>{crd.kind}</TableCell>
                        <TableCell>{crd.scope}</TableCell>
                        <TableCell>{crd.version}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(logPod)}
        onOpenChange={(open) => {
          if (!open) {
            setLogPod(null);
            setLogs('');
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pod Logs</DialogTitle>
            <DialogDescription>
              {logPod?.name} • {logPod?.namespace}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap max-h-[400px] overflow-auto">
            {logs || 'No logs available.'}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
