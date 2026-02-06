'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { S3Browser } from '@/components/storage/s3-browser';

export default function StoragePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Storage</h1>
        <p className="text-muted-foreground">
          Browse and manage files in your organization&apos;s S3 bucket.
        </p>
      </div>

      <Suspense fallback={<StorageSkeleton />}>
        <S3Browser />
      </Suspense>
    </div>
  );
}

function StorageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
