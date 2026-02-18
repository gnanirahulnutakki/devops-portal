'use client';

import { useOrganizationStore } from '@/store/organization-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';
import Link from 'next/link';

export function OrgBanner() {
  const org = useOrganizationStore((s) => s.currentOrganization);

  if (!org) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Building2 className="h-4 w-4" />
      <span>Organization:</span>
      <Badge variant="secondary">{org.name}</Badge>
      {org.role && <Badge variant="outline">{org.role}</Badge>}
      <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
        <Link href="/select-organization">Switch</Link>
      </Button>
    </div>
  );
}
