'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Award,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
} from 'lucide-react';

interface RuleResult {
  ruleId: string;
  ruleName: string;
  category: string;
  level: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  message: string;
  detail?: string;
}

interface AppResult {
  appName: string;
  appNamespace: string;
  appProject: string;
  level: 'BASIC' | 'BRONZE' | 'SILVER' | 'GOLD';
  score: { total: number; passed: number; warned: number; failed: number };
  ruleResults: RuleResult[];
  evaluatedAt: string;
}

const LEVEL_LIST = ['BASIC', 'BRONZE', 'SILVER', 'GOLD'] as const;
const LEVEL_ORDER: Record<string, number> = { BASIC: 0, BRONZE: 1, SILVER: 2, GOLD: 3 };

const STATUS_ICON: Record<string, React.ReactNode> = {
  PASS: <CheckCircle2 className="h-4 w-4 text-rl-green" />,
  WARN: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  FAIL: <XCircle className="h-4 w-4 text-red-500" />,
};

const STATUS_TEXT: Record<string, string> = {
  PASS: 'text-rl-green',
  WARN: 'text-amber-500',
  FAIL: 'text-red-500',
};

const LEVEL_BG: Record<string, string> = {
  GOLD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  SILVER: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300',
  BRONZE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  BASIC: 'bg-muted text-muted-foreground',
};

const CATEGORY_ORDER = ['RELIABILITY', 'DELIVERY', 'OBSERVABILITY', 'SECURITY', 'OWNERSHIP'];

export default function AppScorecardPage() {
  const params = useParams();
  const router = useRouter();
  const appName = decodeURIComponent(params.appName as string);

  const [result, setResult] = useState<AppResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scorecards/results');
      if (!res.ok) throw new Error('Failed to load results');
      const json = await res.json();
      const allResults: AppResult[] = json.data?.results || [];
      const match = allResults.find((r: AppResult) => r.appName === appName);
      setResult(match || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [appName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEvaluate = useCallback(async () => {
    setEvaluating(true);
    setError(null);
    try {
      const res = await fetch('/api/scorecards/evaluate', { method: 'POST' });
      if (!res.ok) throw new Error('Evaluation failed');
      const json = await res.json();
      const allResults: AppResult[] = json.data?.results || [];
      const match = allResults.find((r: AppResult) => r.appName === appName);
      setResult(match || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEvaluating(false);
    }
  }, [appName]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/scorecards')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Scorecards
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Award className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h2 className="text-lg font-semibold mb-2">No Results for {appName}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Run an evaluation to generate scorecard results for this service.
            </p>
            <Button onClick={handleEvaluate} disabled={evaluating}>
              {evaluating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Evaluate Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group rules by category
  const rulesByCategory = new Map<string, RuleResult[]>();
  for (const cat of CATEGORY_ORDER) {
    rulesByCategory.set(cat, []);
  }
  for (const rule of result.ruleResults) {
    const existing = rulesByCategory.get(rule.category) || [];
    existing.push(rule);
    rulesByCategory.set(rule.category, existing);
  }

  const currentLevelIdx = LEVEL_ORDER[result.level];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.push('/scorecards')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Scorecards
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {appName}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant="outline" className={LEVEL_BG[result.level]}>
              Level: {result.level}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Score: {result.score.passed}/{result.score.total}
            </span>
            <span className="text-sm text-muted-foreground">
              Last evaluated: {formatTimeAgo(new Date(result.evaluatedAt))}
            </span>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleEvaluate}
          disabled={evaluating}
        >
          {evaluating ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Re-evaluate
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Level Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Level Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {LEVEL_LIST.map((level, idx) => {
              const passed = idx <= currentLevelIdx;
              const isCurrent = idx === currentLevelIdx;
              return (
                <div key={level} className="flex items-center gap-2">
                  {idx > 0 && (
                    <div
                      className={`w-8 h-0.5 ${
                        idx <= currentLevelIdx ? 'bg-rl-green' : 'bg-muted'
                      }`}
                    />
                  )}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                      passed
                        ? 'bg-rl-green/10 text-rl-green border border-rl-green/30'
                        : 'bg-muted text-muted-foreground border border-muted'
                    } ${isCurrent ? 'ring-2 ring-rl-green/40' : ''}`}
                  >
                    {passed ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 inline-block" />
                    )}
                    {level}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Rules by Category */}
      {CATEGORY_ORDER.map((category) => {
        const rules = rulesByCategory.get(category);
        if (!rules || rules.length === 0) return null;

        return (
          <Card key={category}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide">
                {category}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {rules.map((rule) => (
                <div
                  key={rule.ruleId}
                  className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/50"
                >
                  {STATUS_ICON[rule.status]}
                  <span className={`text-xs font-medium uppercase ${STATUS_TEXT[rule.status]}`}>
                    {rule.status}
                  </span>
                  <span className="text-sm font-medium flex-1">{rule.ruleName}</span>
                  <span className="text-sm text-muted-foreground">{rule.message}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {rule.level}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
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
