'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  KeyRound, ShieldCheck, Clock, AlertTriangle, RefreshCw, Activity, Loader2,
} from 'lucide-react';
import { useOrganizationStore } from '@/store/organization-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CredentialHealth {
  id: string;
  provider: string;
  name: string;
  enabled: boolean;
  healthStatus: string | null;
  lastHealthCheckAt: string | null;
  lastUsedAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  expiresAt: string | null;
  rotatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface HealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  unknown: number;
  credentials: CredentialHealth[];
}

interface ExpiringCredential {
  id: string;
  provider: string;
  name: string;
  expiresAt: string;
  healthStatus: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(date: string | null): string {
  if (!date) return 'Never';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function daysUntilExpiry(date: string | null): number | null {
  if (!date) return null;
  const now = new Date();
  const expiry = new Date(date);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'degraded': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'unhealthy': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    ARGOCD: 'ArgoCD',
    GRAFANA: 'Grafana',
    PROMETHEUS: 'Prometheus',
    GITHUB: 'GitHub',
    GITLAB: 'GitLab',
    S3: 'S3',
    SLACK: 'Slack',
    PAGERDUTY: 'PagerDuty',
    LLM: 'LLM',
    UPTIME_KUMA: 'Uptime Kuma',
    SUPABASE: 'Supabase',
    VANTA: 'Vanta',
  };
  return labels[provider] || provider;
}

function formatExpiryDate(date: string | null): string {
  if (!date) return '\u2014';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon, title, value, color,
}: {
  icon: typeof KeyRound; title: string; value: number; color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${color || 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CredentialHealthPage() {
  const [healthData, setHealthData] = useState<HealthSummary | null>(null);
  const [expiringData, setExpiringData] = useState<ExpiringCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [healthRes, expiringRes] = await Promise.all([
        fetch('/api/integrations/credentials/health', {
          headers: { 'x-organization-id': currentOrganization.id },
        }),
        fetch('/api/integrations/credentials/expiring?days=30', {
          headers: { 'x-organization-id': currentOrganization.id },
        }),
      ]);

      if (!healthRes.ok) {
        const body = await healthRes.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${healthRes.status}`);
      }

      const healthJson = await healthRes.json();
      const expiringJson = await expiringRes.json();

      if (healthJson.data) setHealthData(healthJson.data);
      if (expiringRes.ok && expiringJson.data) {
        setExpiringData(expiringJson.data.credentials ?? []);
      }
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load credential health data');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleRecheck(credentialId: string) {
    if (!currentOrganization?.id) return;
    setCheckingId(credentialId);
    try {
      await fetch(`/api/integrations/credentials/${credentialId}/check`, {
        method: 'POST',
        headers: { 'x-organization-id': currentOrganization.id },
      });
      await fetchData();
    } finally {
      setCheckingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Credential Health
          </h1>
          <p className="text-muted-foreground">
            Monitor the health and expiry of your integration credentials.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm">{error}</p>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchData}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && !healthData && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20 mb-2" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* Data loaded */}
      {healthData && (
        <>
          {/* Stats row */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={KeyRound}
              title="Total Credentials"
              value={healthData.total}
            />
            <StatCard
              icon={ShieldCheck}
              title="Healthy"
              value={healthData.healthy}
              color="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              icon={Clock}
              title="Expiring Soon"
              value={expiringData.length}
              color="text-amber-600 dark:text-amber-400"
            />
            <StatCard
              icon={AlertTriangle}
              title="Unhealthy"
              value={healthData.unhealthy}
              color="text-red-600 dark:text-red-400"
            />
          </div>

          {/* Credentials Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">All Credentials</CardTitle>
            </CardHeader>
            <CardContent>
              {healthData.credentials.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No credentials configured yet. Add integrations in Settings.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Checked</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthData.credentials.map((cred) => {
                      const status = cred.healthStatus || 'unknown';
                      const days = daysUntilExpiry(cred.expiresAt);
                      return (
                        <TableRow key={cred.id}>
                          <TableCell className="font-medium">{cred.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {providerLabel(cred.provider)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(status)} variant="secondary">
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatRelativeTime(cred.lastHealthCheckAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {cred.expiresAt ? (
                              <span className={days !== null && days <= 7 ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                                {formatExpiryDate(cred.expiresAt)}
                              </span>
                            ) : (
                              '\u2014'
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRecheck(cred.id)}
                              disabled={checkingId === cred.id}
                            >
                              {checkingId === cred.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                              <span className="ml-1.5">Re-check</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Expiring Soon */}
          {expiringData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Expiring Soon
                  <span className="text-muted-foreground font-normal">
                    &mdash; within 30 days
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {expiringData
                    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
                    .map((cred) => {
                      const days = daysUntilExpiry(cred.expiresAt);
                      const urgent = days !== null && days <= 7;
                      return (
                        <div
                          key={cred.id}
                          className="flex items-center justify-between rounded-lg border px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <KeyRound className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{cred.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {providerLabel(cred.provider)}
                              </p>
                            </div>
                          </div>
                          <Badge
                            className={
                              urgent
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                            }
                            variant="secondary"
                          >
                            {days !== null
                              ? days <= 0
                                ? 'Expired'
                                : `${days} day${days !== 1 ? 's' : ''} left`
                              : 'Unknown'}
                          </Badge>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
