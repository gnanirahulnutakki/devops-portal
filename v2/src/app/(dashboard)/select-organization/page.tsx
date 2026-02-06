'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, ChevronRight, Plus } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export default function SelectOrganizationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

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
      const data = await response.json();
      
      if (data.success) {
        setOrganizations(data.data);
        
        // If only one org, auto-select it
        if (data.data.length === 1) {
          selectOrganization(data.data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  }

  function selectOrganization(orgId: string) {
    // Set cookie for middleware
    document.cookie = `organization-id=${orgId}; path=/; max-age=${60 * 60 * 24 * 30}`;
    router.push(callbackUrl);
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
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Organization
              </Button>
            </div>
          ) : (
            organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => selectOrganization(org.id)}
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
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
