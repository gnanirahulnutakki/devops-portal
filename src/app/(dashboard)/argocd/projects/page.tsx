'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { OrgBanner } from '@/components/dashboard/org-banner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { 
  RefreshCw, 
  ExternalLink, 
  AlertCircle, 
  Shield, 
  Globe, 
  Server, 
  Search,
  Lock,
  Users
} from 'lucide-react';

type AppProject = {
  name: string;
  description: string;
  sourceRepos: string[];
  destinations: {
    server: string;
    namespace: string;
    name?: string;
  }[];
  clusterResourceWhitelist: {
    group: string;
    kind: string;
  }[];
  namespaceResourceBlacklist: {
    group: string;
    kind: string;
  }[];
  roles: {
    name: string;
    description?: string;
    policies: number;
    groups: number;
  }[];
  signatureKeys: string[];
  externalUrl: string;
};

function getServerShortName(server: string) {
  if (!server) return '—';
  if (server === 'https://kubernetes.default.svc') return 'in-cluster';
  try {
    const url = new URL(server);
    return url.hostname;
  } catch {
    const parts = server.split('/');
    return parts[parts.length - 1] || server;
  }
}

export default function ArgoCDProjectsPage() {
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);
  const [filter, setFilter] = useState('');
  const [items, setItems] = useState<AppProject[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/argocd/projects', {
        headers: { 'x-organization-id': orgId },
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message || res.statusText);
        setItems(null);
        return;
      }
      setItems(body.data ?? []);
    } catch (e) {
      setError((e as Error).message);
      setItems(null);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) => 
        p.name.toLowerCase().includes(q) || 
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [items, filter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">AppProjects</h1>
          <Button 
            onClick={() => void load()} 
            disabled={loading || !orgId} 
            size="sm" 
            variant="outline"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
        <OrgBanner />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter projects by name or description..."
            className="pl-9"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {!orgId && (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium">No Organization Selected</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Please select an organization from the banner above to view ArgoCD AppProjects.
            </p>
          </CardContent>
        </Card>
      )}

      {orgId && loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex flex-col h-full">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="space-y-4 flex-1">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {orgId && error && !loading && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <h3 className="text-lg font-semibold text-destructive">Failed to load AppProjects</h3>
              <p className="text-sm text-muted-foreground max-w-[400px]">
                {error}
              </p>
              <Button variant="outline" size="sm" onClick={() => void load()} className="mt-2">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {orgId && !loading && !error && items && filteredItems.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Shield className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium">
              {items.length === 0 ? "No AppProjects defined" : "No projects match your filter"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-[450px]">
              {items.length === 0 ? (
                <>
                  AppProjects provide a logical grouping for ArgoCD applications and control access to resources.
                  Visit the <a href="https://argo-cd.readthedocs.io/en/stable/user-guide/projects/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ArgoCD documentation</a> to learn how to define them.
                </>
              ) : (
                "Try adjusting your filter to find the project you're looking for."
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {orgId && !loading && !error && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((project) => (
            <Card key={project.name} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-xl truncate" title={project.name}>
                    {project.name}
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <a href={project.externalUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                  {project.description || "No description provided."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Globe className="h-3.5 w-3.5" />
                    Allowed source repos
                  </div>
                  {project.sourceRepos.includes('*') ? (
                    <Badge variant="outline" className="font-mono text-[10px] bg-primary/5 text-primary border-primary/20">
                      Any (*)
                    </Badge>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {project.sourceRepos.length > 0 ? (
                        project.sourceRepos.map((repo, i) => (
                          <Badge key={i} variant="secondary" className="font-mono text-[10px] py-0 px-1.5">
                            {repo}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">None defined</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Server className="h-3.5 w-3.5" />
                    Destinations
                  </div>
                  <div className="bg-muted/30 rounded-md border border-border/50 divide-y divide-border/50 overflow-hidden">
                    {project.destinations.length > 0 ? (
                      project.destinations.map((d, i) => (
                        <div key={i} className="flex items-center justify-between p-2 text-[11px]">
                          <span className="font-mono truncate max-w-[160px]" title={d.server}>
                            {getServerShortName(d.server)}
                          </span>
                          <Badge variant="outline" className="h-4 px-1 text-[10px] font-mono border-none bg-background/50">
                            {d.namespace || '*'}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="p-2 text-[11px] text-muted-foreground italic">None defined</div>
                    )}
                  </div>
                </div>

                {project.roles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Lock className="h-3.5 w-3.5" />
                      Roles
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {project.roles.map((role) => (
                        <div key={role.name} className="flex items-center justify-between bg-muted/20 p-1.5 rounded-sm border border-border/30">
                          <span className="text-[11px] font-medium truncate pr-2">{role.name}</span>
                          <div className="flex gap-1 shrink-0">
                            <Badge variant="outline" className="h-4 px-1 text-[9px] bg-background">
                              {role.policies} pol
                            </Badge>
                            <Badge variant="outline" className="h-4 px-1 text-[9px] bg-background">
                              {role.groups} grp
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {project.clusterResourceWhitelist.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Shield className="h-3.5 w-3.5" />
                      Cluster Whitelist ({project.clusterResourceWhitelist.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {project.clusterResourceWhitelist.slice(0, 5).map((w, idx) => (
                        <Badge key={idx} variant="outline" className="text-[10px] py-0 px-1 font-mono">
                          {w.group || '*'}/{w.kind}
                        </Badge>
                      ))}
                      {project.clusterResourceWhitelist.length > 5 && (
                        <span className="text-[10px] text-muted-foreground py-0.5 px-1 bg-muted/50 rounded">
                          +{project.clusterResourceWhitelist.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
