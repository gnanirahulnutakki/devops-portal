'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building2, ChevronRight, Plus, Loader2, AlertCircle } from 'lucide-react';
import { useOrganizationStore, UserRole } from '@/store/organization-store';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

function SelectOrganizationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const setOrganization = useOrganizationStore((state) => state.setOrganization);

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const manageMode = searchParams.get('manage') === '1';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated') {
      fetchOrganizations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router]);

  async function fetchOrganizations() {
    try {
      const response = await fetch('/api/organizations');
      const result = await response.json();
      
      if (response.ok && result.data) {
        setOrganizations(result.data);
        
        // If only one org, auto-select it
        // Pass the org object directly -- don't rely on React state which hasn't updated yet
        if (!manageMode && result.data.length === 1) {
          selectOrganization(result.data[0]);
        }
      }
    } catch {
      // Silently fail - user will see empty state
    } finally {
      setLoading(false);
    }
  }

  function selectOrganization(org: Organization) {
    // Set organization in Zustand store (persisted to localStorage)
    setOrganization({
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: org.role as UserRole,
    });
    
    // Set cookie for middleware with security flags
    // Note: httpOnly can only be set server-side; middleware re-sets it with httpOnly on next request
    const isSecure = window.location.protocol === 'https:';
    document.cookie = `organization-id=${org.id}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax${isSecure ? '; secure' : ''}`;
    router.push(callbackUrl);
  }

  // Auto-generate slug from name
  function handleNameChange(name: string) {
    setCreateName(name);
    setCreateSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    );
    setCreateError(null);
  }

  async function handleCreateOrganization() {
    if (!createName.trim() || !createSlug.trim()) {
      setCreateError('Name and slug are required');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName, slug: createSlug }),
      });
      const result = await response.json();

      if (!response.ok) {
        setCreateError(result.error?.message || 'Failed to create organization');
        return;
      }

      // Select the newly created org (user is ADMIN)
      selectOrganization({
        id: result.data.id,
        name: result.data.name,
        slug: result.data.slug,
        role: 'ADMIN',
      });
    } catch {
      setCreateError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-rl-navy/10 rounded-lg flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-rl-navy" />
          </div>
          <CardTitle className="text-2xl">Select Organization</CardTitle>
          <CardDescription>
            Choose an organization to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {organizations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                You don&apos;t belong to any organization yet.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Organization
              </Button>
            </div>
          ) : (
            <>
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => selectOrganization(org)}
                  className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rl-navy/10 rounded-lg flex items-center justify-center">
                      <span className="text-rl-navy font-semibold">
                        {org.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-sm text-gray-500">
                        {org.role.toLowerCase()} · {org.slug}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </button>
              ))}
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Organization
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Organization Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new organization. You will be the admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="My Team"
                value={createName}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug">Slug</Label>
              <Input
                id="org-slug"
                placeholder="my-team"
                value={createSlug}
                onChange={(e) => { setCreateSlug(e.target.value); setCreateError(null); }}
                disabled={creating}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrganization}
              disabled={creating || !createName.trim() || !createSlug.trim()}
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function SelectOrganizationPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SelectOrganizationContent />
    </Suspense>
  );
}
