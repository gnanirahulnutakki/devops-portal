'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { RefreshCw, AlertTriangle, Search } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface Rollout {
  name: string;
  namespace: string;
  strategy: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  canary?: { weight: number; currentPodHash: string };
  blueGreen?: { active: string; preview: string };
  replicas: { desired: number; available: number; current: number; updated: number };
  age: string;
  message: string;
}

export default function RolloutsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { currentOrganization } = useOrganizationStore();
  const [rollouts, setRollouts] = useState<Rollout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRollouts = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/clusters/${id}/rollouts`, {
        headers: {
          'x-organization-id': currentOrganization.id,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || { code: 'UNKNOWN_ERROR', message: 'Failed to fetch rollouts' });
      } else {
        setRollouts(result.data || []);
      }
    } catch (err) {
      setError({ code: 'FETCH_ERROR', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, [id, currentOrganization?.id]);

  useEffect(() => {
    fetchRollouts();
  }, [fetchRollouts]);

  const filteredRollouts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return rollouts.filter(r => 
      r.name.toLowerCase().includes(query) || 
      r.namespace.toLowerCase().includes(query)
    );
  }, [rollouts, searchQuery]);

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (status.toLowerCase()) {
      case 'healthy': return 'default';
      case 'paused': return 'secondary';
      case 'progressing': return 'outline';
      case 'degraded':
      case 'aborted': return 'destructive';
      default: return 'outline';
    }
  };

  const getStrategyVariant = (strategy: string): "default" | "secondary" | "outline" => {
    switch (strategy.toLowerCase()) {
      case 'canary': return 'default';
      case 'bluegreen': return 'secondary';
      default: return 'outline';
    }
  };

  if (error?.code === 'ROLLOUTS_CRD_NOT_INSTALLED') {
    return (
      <div className="p-6">
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-900/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-500 mt-1" />
              <div className="space-y-2">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">Argo Rollouts Not Found</h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Argo Rollouts CRDs are not installed in this cluster. Install argo-rollouts to manage progressive delivery here.
                </p>
                <Button variant="outline" size="sm" onClick={fetchRollouts} className="mt-2 bg-white dark:bg-slate-950">
                  <RefreshCw className="mr-2 h-4 w-4" /> Retry Check
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Argo Rollouts</h1>
          <p className="text-muted-foreground">Manage progressive delivery resources across namespaces.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRollouts} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by name or namespace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {error ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Rollouts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{error.message}</p>
            <Button variant="outline" onClick={fetchRollouts}>Retry</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Replicas</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Age</TableHead>
                <TableHead className="w-[300px]">Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                  </TableRow>
                ))
              ) : filteredRollouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    {searchQuery ? 'No rollouts matching your filter' : 'No Argo Rollouts found in this cluster'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRollouts.map((rollout) => (
                  <TableRow key={`${rollout.namespace}/${rollout.name}`}>
                    <TableCell className="font-medium">{rollout.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{rollout.namespace}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStrategyVariant(rollout.strategy)}>{rollout.strategy}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(rollout.status)}>{rollout.status}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {rollout.replicas.available}/{rollout.replicas.desired} ({rollout.replicas.current} {rollout.replicas.updated})
                    </TableCell>
                    <TableCell>
                      {rollout.strategy.toLowerCase() === 'canary' 
                        ? `${rollout.currentStep + 1}/${rollout.totalSteps}` 
                        : '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatRelativeTime(rollout.age)}
                    </TableCell>
                    <TableCell>
                      <p 
                        className="text-xs truncate max-w-[280px] text-muted-foreground" 
                        title={rollout.message}
                      >
                        {rollout.message || 'No status message'}
                      </p>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
