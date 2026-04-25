'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MetricCard } from '@/components/dashboard/metric-card';
import {
  Award,
  RefreshCw,
  Play,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
} from 'lucide-react';

interface AppResult {
  appName: string;
  appNamespace: string;
  appProject: string;
  level: 'BASIC' | 'BRONZE' | 'SILVER' | 'GOLD';
  score: { total: number; passed: number; warned: number; failed: number };
  ruleResults: any[];
  evaluatedAt: string;
}

interface ScorecardData {
  id: string;
  name: string;
  rules: any[];
}

const LEVEL_ORDER = { GOLD: 0, SILVER: 1, BRONZE: 2, BASIC: 3 };
const LEVEL_COLORS: Record<string, string> = {
  GOLD: 'text-yellow-600 dark:text-yellow-400',
  SILVER: 'text-gray-500 dark:text-gray-300',
  BRONZE: 'text-amber-700 dark:text-amber-500',
  BASIC: 'text-muted-foreground',
};
const LEVEL_BG: Record<string, string> = {
  GOLD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  SILVER: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300',
  BRONZE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  BASIC: 'bg-muted text-muted-foreground',
};
const LEVEL_ICON: Record<string, string> = {
  GOLD: '🥇',
  SILVER: '🥈',
  BRONZE: '🥉',
  BASIC: '──',
};

export default function ScorecardsPage() {
  const router = useRouter();
  const [results, setResults] = useState<AppResult[]>([]);
  const [scorecards, setScorecards] = useState<ScorecardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stale, setStale] = useState(false);
  const [evaluatedAt, setEvaluatedAt] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [scRes, resRes] = await Promise.all([
        fetch('/api/scorecards'),
        fetch('/api/scorecards/results'),
      ]);

      if (scRes.ok) {
        const scJson = await scRes.json();
        setScorecards(scJson.data || []);
      }

      if (resRes.ok) {
        const resJson = await resRes.json();
        setResults(resJson.data?.results || []);
        setStale(resJson.data?.stale ?? true);
        setEvaluatedAt(resJson.data?.evaluatedAt || null);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load scorecards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSeed = useCallback(async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/scorecards/seed', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Failed to seed');
      }
      await fetchData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSeeding(false);
    }
  }, [fetchData]);

  const handleEvaluate = useCallback(async () => {
    setEvaluating(true);
    setError(null);
    try {
      const res = await fetch('/api/scorecards/evaluate', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Evaluation failed');
      }
      const json = await res.json();
      setResults(json.data?.results || []);
      setEvaluatedAt(json.data?.evaluatedAt || null);
      setStale(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEvaluating(false);
    }
  }, []);

  // Level distribution
  const levelCounts = useMemo(() => {
    const counts = { GOLD: 0, SILVER: 0, BRONZE: 0, BASIC: 0 };
    for (const r of results) {
      counts[r.level] = (counts[r.level] || 0) + 1;
    }
    return counts;
  }, [results]);

  // Filtered & sorted results
  const filteredResults = useMemo(() => {
    let filtered = results;
    if (search) {
      const q = search.toLowerCase();
      filtered = results.filter((r) => r.appName.toLowerCase().includes(q));
    }
    return [...filtered].sort(
      (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]
    );
  }, [results, search]);

  const total = results.length;

  // Format relative time
  const timeAgo = evaluatedAt
    ? formatTimeAgo(new Date(evaluatedAt))
    : 'Never';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Empty state: no scorecards exist yet
  if (scorecards.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Award className="h-6 w-6" />
          Service Scorecards
        </h1>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Award className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h2 className="text-lg font-semibold mb-2">No Scorecards Yet</h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Scorecards evaluate your services against reliability, security,
              delivery, observability, and ownership standards. Seed a default
              scorecard to get started.
            </p>
            <Button onClick={handleSeed} disabled={seeding}>
              {seeding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Seed Default Scorecard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6" />
            Service Scorecards
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last evaluated: {timeAgo}
            {stale && results.length > 0 && (
              <span className="text-amber-600 ml-2">(stale)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleEvaluate}
            disabled={evaluating}
          >
            {evaluating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            Evaluate Now
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Level Distribution Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Gold"
          value={levelCounts.GOLD}
          description={total > 0 ? `${Math.round((levelCounts.GOLD / total) * 100)}%` : '0%'}
          icon={Award}
          valueClassName="text-yellow-600 dark:text-yellow-400"
        />
        <MetricCard
          title="Silver"
          value={levelCounts.SILVER}
          description={total > 0 ? `${Math.round((levelCounts.SILVER / total) * 100)}%` : '0%'}
          icon={Award}
          valueClassName="text-gray-500 dark:text-gray-300"
        />
        <MetricCard
          title="Bronze"
          value={levelCounts.BRONZE}
          description={total > 0 ? `${Math.round((levelCounts.BRONZE / total) * 100)}%` : '0%'}
          icon={Award}
          valueClassName="text-amber-700 dark:text-amber-500"
        />
        <MetricCard
          title="Basic"
          value={levelCounts.BASIC}
          description={total > 0 ? `${Math.round((levelCounts.BASIC / total) * 100)}%` : '0%'}
          icon={Award}
          valueClassName="text-muted-foreground"
        />
      </div>

      {/* Distribution Bar */}
      {total > 0 && (
        <div className="flex h-3 rounded-full overflow-hidden bg-muted">
          {levelCounts.GOLD > 0 && (
            <div
              className="bg-yellow-500 transition-all"
              style={{ width: `${(levelCounts.GOLD / total) * 100}%` }}
            />
          )}
          {levelCounts.SILVER > 0 && (
            <div
              className="bg-gray-400 transition-all"
              style={{ width: `${(levelCounts.SILVER / total) * 100}%` }}
            />
          )}
          {levelCounts.BRONZE > 0 && (
            <div
              className="bg-amber-600 transition-all"
              style={{ width: `${(levelCounts.BRONZE / total) * 100}%` }}
            />
          )}
          {levelCounts.BASIC > 0 && (
            <div
              className="bg-muted-foreground/30 transition-all"
              style={{ width: `${(levelCounts.BASIC / total) * 100}%` }}
            />
          )}
        </div>
      )}

      {/* Services Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>All Services</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Award className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                No results yet. Click &quot;Evaluate Now&quot; to score your services.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">
                    <CheckCircle2 className="h-4 w-4 inline text-rl-green" /> Pass
                  </TableHead>
                  <TableHead className="text-center">
                    <AlertTriangle className="h-4 w-4 inline text-amber-500" /> Warn
                  </TableHead>
                  <TableHead className="text-center">
                    <XCircle className="h-4 w-4 inline text-red-500" /> Fail
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((r) => (
                  <TableRow
                    key={r.appName}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/scorecards/${encodeURIComponent(r.appName)}`)}
                  >
                    <TableCell className="font-medium">{r.appName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={LEVEL_BG[r.level]}>
                        {LEVEL_ICON[r.level]} {r.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {r.score.passed}/{r.score.total}
                    </TableCell>
                    <TableCell className="text-center text-rl-green font-medium">
                      {r.score.passed}
                    </TableCell>
                    <TableCell className="text-center text-amber-500 font-medium">
                      {r.score.warned}
                    </TableCell>
                    <TableCell className="text-center text-red-500 font-medium">
                      {r.score.failed}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
