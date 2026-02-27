'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ky from 'ky';

// =============================================================================
// Types
// =============================================================================

interface Repository {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  defaultBranch: string;
  url: string;
  updatedAt: string;
}

interface Branch {
  name: string;
  sha: string;
  protected: boolean;
}

interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed' | 'merged';
  draft?: boolean;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  url: string;
}

interface CreatePRParams {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
}

// =============================================================================
// API Client
// =============================================================================

const api = ky.create({
  prefixUrl: '/api',
  timeout: 30000,
});

// =============================================================================
// Hooks
// =============================================================================

export function useRepositories(page = 1, pageSize = 20, search?: string, credentialId?: string) {
  return useQuery({
    queryKey: ['github', 'repositories', { page, pageSize, search, credentialId }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set('search', search);
      if (credentialId) params.set('credentialId', credentialId);

      const response = await api.get(`github/repositories?${params}`).json<{
        data: Repository[];
      }>();
      return response.data ?? [];
    },
    enabled: !!credentialId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useBranches(repository?: string, filter?: string, credentialId?: string) {
  return useQuery({
    queryKey: ['github', 'branches', repository, filter, credentialId],
    queryFn: async () => {
      if (!repository) return [];
      const params = new URLSearchParams({ repository });
      if (filter) params.set('filter', filter);
      if (credentialId) params.set('credentialId', credentialId);
      const response = await api.get(`github/branches?${params}`).json<{
        data: Branch[];
      }>();
      return response.data ?? [];
    },
    enabled: !!repository,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function usePullRequests(
  repository?: string,
  state: 'open' | 'closed' | 'all' = 'open',
  credentialId?: string
) {
  return useQuery({
    queryKey: ['github', 'pull-requests', { repository, state, credentialId }],
    queryFn: async () => {
      const params = new URLSearchParams({ state });
      if (repository) params.set('repository', repository);
      if (credentialId) params.set('credentialId', credentialId);

      const response = await api.get(`github/pull-requests?${params}`).json<{
        data: PullRequest[];
      }>();
      return response.data ?? [];
    },
    // When called with a specific repo (detail page), always run.
    // When called without a repo (listing page), require credentialId.
    enabled: !!repository || !!credentialId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

export function usePullRequestFiles(repository?: string, number?: number) {
  return useQuery({
    queryKey: ['github', 'pull-request-files', { repository, number }],
    queryFn: async () => {
      if (!repository || !number) return [];
      const params = new URLSearchParams({
        repository,
        number: String(number),
      });
      const response = await api.get(`github/pull-requests/files?${params}`).json<{
        data: Array<{
          filename: string;
          status: string;
          additions: number;
          deletions: number;
          changes: number;
          patch?: string;
        }>;
      }>();
      return response.data ?? [];
    },
    enabled: !!repository && !!number,
    staleTime: 60 * 1000,
  });
}

export function useUpdatePullRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      repository: string;
      number: number;
      action: 'draft' | 'ready' | 'close' | 'reopen';
    }) => {
      const response = await api.patch('github/pull-requests', {
        json: params,
      }).json<{ data: PullRequest }>();
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github', 'pull-requests'] });
      toast.success('Pull request updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update pull request', { description: error.message });
    },
  });
}

export function useMergePullRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      repository: string;
      number: number;
      method?: 'merge' | 'squash' | 'rebase';
    }) => {
      const response = await api.post('github/pull-requests/merge', {
        json: params,
      }).json<{ data: { merged: boolean; message: string } }>();
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['github', 'pull-requests'] });
      toast.success(data.merged ? 'Pull request merged' : 'Merge failed', {
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to merge pull request', { description: error.message });
    },
  });
}

export function useCreatePullRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: CreatePRParams) => {
      const response = await api.post('github/pull-requests', {
        json: params,
      }).json<{
        data: PullRequest;
      }>();
      return response.data;
    },
    onSuccess: (data, _variables) => {
      toast.success('Pull request created', {
        description: `#${data.number}: ${data.title}`,
      });
      queryClient.invalidateQueries({
        queryKey: ['github', 'pull-requests'],
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create pull request', {
        description: error.message,
      });
    },
  });
}
