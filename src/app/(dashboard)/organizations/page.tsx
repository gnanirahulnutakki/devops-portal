'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, RefreshCw, ShieldCheck, Server, Layers } from 'lucide-react';

type OrganizationItem = {
  id: string;
  name: string;
  slug: string;
  role?: string;
};

const segmentRules = [
  { key: 'infra', label: 'Infra (Duplo)', icon: Server, match: ['duplo', 'infra', 'platform'] },
  { key: 'security', label: 'Security', icon: ShieldCheck, match: ['security', 'sec', 'audit'] },
  { key: 'apps', label: 'Apps', icon: Layers, match: ['app', 'portal', 'product'] },
  { key: 'core', label: 'Core', icon: Building2, match: [] },
];

const resolveSegment = (name: string) => {
  const text = name.toLowerCase();
  for (const rule of segmentRules) {
    if (rule.match.length === 0) continue;
    if (rule.match.some((token) => text.includes(token))) {
      return rule.key;
    }
  }
  return 'core';
};

export default function OrganizationsPage() {
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/organizations');
      const data = await res.json();
      if (res.ok) {
        setOrganizations(data.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const grouped = useMemo(() => {
    const buckets: Record<string, OrganizationItem[]> = {};
    organizations.forEach((org) => {
      const segment = resolveSegment(org.name);
      if (!buckets[segment]) buckets[segment] = [];
      buckets[segment].push(org);
    });
    return buckets;
  }, [organizations]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Organizations</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Logical segmentation for platform, infra, and security teams
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrganizations} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Orgs</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-16" /> : organizations.length}
            </CardTitle>
          </CardHeader>
        </Card>
        {segmentRules.map((segment) => (
          <Card key={segment.key}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <segment.icon className="h-4 w-4 text-muted-foreground" />
                {segment.label}
              </CardDescription>
              <CardTitle className="text-2xl">
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  grouped[segment.key]?.length || 0
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization Segments
          </CardTitle>
          <CardDescription>
            Use these segments to separate infra (Duplo), security, apps, and core teams
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {segmentRules.map((segment) => {
            const items = grouped[segment.key] || [];
            return (
              <div key={segment.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <segment.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{segment.label}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                {loading ? (
                  <Skeleton className="h-12 w-full" />
                ) : items.length === 0 ? (
                  <p className="text-sm text-gray-500">No organizations in this segment.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map((org) => (
                      <div
                        key={org.id}
                        className={`flex items-center justify-between rounded-lg border p-3 ${
                          currentOrganization?.id === org.id ? 'border-primary bg-muted' : ''
                        }`}
                      >
                        <div>
                          <p className="font-medium">{org.name}</p>
                          <p className="text-xs text-muted-foreground">{org.slug}</p>
                        </div>
                        {org.role ? <Badge variant="outline">{org.role}</Badge> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
