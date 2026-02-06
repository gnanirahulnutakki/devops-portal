'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ky from 'ky';

// =============================================================================
// Types
// =============================================================================

interface ArgoCDApplication {
  name: string;
  namespace: string;
  project: string;
  syncStatus: string;
  healthStatus: string;
  source: {
    repoURL: string;
    path: string;
    targetRevision: string;
  };
  destination: {
    server: string;
    namespace: string;
  };
  createdAt: string;
  syncedAt?: string;
}

interface SyncParams {
  name: string;
  revision?: string;
  prune?: boolean;
  dryRun?: boolean;
}

// =============================================================================
// API Client
// =============================================================================

const api = ky.create({
  prefixUrl: '/api',
  timeout: 60000, // ArgoCD sync can take longer
});

// =============================================================================
// Hooks
// =============================================================================

export function useArgoCDApplications(project?: string) {
  return useQuery({
    queryKey: ['argocd', 'applications', { project }],
    queryFn: async () => {
      const params = project ? `?project=${project}` : '';
      const response = await api.get(`argocd/applications${params}`).json<{
        success: boolean;
        data: ArgoCDApplication[];
      }>();
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });
}

export function useArgoCDApplication(name: string) {
  return useQuery({
    queryKey: ['argocd', 'application', name],
    queryFn: async () => {
      const response = await api.get(`argocd/applications/${name}`).json<{
        success: boolean;
        data: ArgoCDApplication;
      }>();
      return response.data;
    },
    enabled: !!name,
    staleTime: 15 * 1000, // 15 seconds
  });
}

export function useSyncApplication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ name, revision, prune, dryRun }: SyncParams) => {
      const response = await api.post(`argocd/applications/${name}/sync`, {
        json: { revision, prune, dryRun },
      }).json<{
        success: boolean;
        data: { phase: string; message: string };
      }>();
      return response.data;
    },
    onSuccess: (data, variables) => {
      toast.success('Sync initiated', {
        description: `${variables.name}: ${data.phase}`,
      });
      // Invalidate to refresh application list
      queryClient.invalidateQueries({
        queryKey: ['argocd', 'applications'],
      });
      queryClient.invalidateQueries({
        queryKey: ['argocd', 'application', variables.name],
      });
    },
    onError: (error: Error, variables) => {
      toast.error('Sync failed', {
        description: `${variables.name}: ${error.message}`,
      });
    },
  });
}

export function useRefreshApplication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post(`argocd/applications/${name}/refresh`).json<{
        success: boolean;
        data: ArgoCDApplication;
      }>();
      return response.data;
    },
    onSuccess: (_, name) => {
      toast.success('Application refreshed');
      queryClient.invalidateQueries({
        queryKey: ['argocd', 'application', name],
      });
    },
    onError: (error: Error) => {
      toast.error('Refresh failed', {
        description: error.message,
      });
    },
  });
}

// =============================================================================
// Resources Hook
// =============================================================================

export interface ArgoCDResource {
  group: string;
  kind: string;
  namespace: string;
  name: string;
  status: string;
  health?: {
    status: string;
    message?: string;
  };
  syncWave?: number;
  version: string;
  createdAt?: string;
}

export function useApplicationResources(name: string) {
  return useQuery({
    queryKey: ['argocd', 'application', name, 'resources'],
    queryFn: async () => {
      const response = await api.get(`argocd/applications/${name}/resources`).json<{
        success: boolean;
        data: ArgoCDResource[];
      }>();
      return response.data;
    },
    enabled: !!name,
    staleTime: 30 * 1000,
  });
}

// =============================================================================
// History Hook
// =============================================================================

export interface ArgoCDHistoryEntry {
  id: number;
  revision: string;
  deployedAt: string;
  deployStartedAt?: string;
  source: {
    repoURL: string;
    path: string;
    targetRevision: string;
  };
  initiatedBy?: {
    username?: string;
    automated?: boolean;
  };
}

export function useApplicationHistory(name: string) {
  return useQuery({
    queryKey: ['argocd', 'application', name, 'history'],
    queryFn: async () => {
      const response = await api.get(`argocd/applications/${name}/history`).json<{
        success: boolean;
        data: ArgoCDHistoryEntry[];
      }>();
      return response.data;
    },
    enabled: !!name,
    staleTime: 60 * 1000, // History changes less frequently
  });
}

// =============================================================================
// Projects Hook (for filtering)
// =============================================================================

export function useArgoCDProjects() {
  return useQuery({
    queryKey: ['argocd', 'projects'],
    queryFn: async () => {
      // Extract unique projects from applications
      const response = await api.get('argocd/applications').json<{
        success: boolean;
        data: ArgoCDApplication[];
      }>();
      const projects = [...new Set(response.data.map(app => app.project))];
      return projects.sort();
    },
    staleTime: 5 * 60 * 1000, // Projects change rarely
  });
}
