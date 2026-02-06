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

export function useRepositories(page = 1, pageSize = 20, search?: string) {
  return useQuery({
    queryKey: ['github', 'repositories', { page, pageSize, search }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set('search', search);
      
      const response = await api.get(`github/repositories?${params}`).json<{
        success: boolean;
        data: Repository[];
      }>();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useBranches(owner: string, repo: string) {
  return useQuery({
    queryKey: ['github', 'branches', owner, repo],
    queryFn: async () => {
      const response = await api.get(`github/branches?owner=${owner}&repo=${repo}`).json<{
        success: boolean;
        data: Branch[];
      }>();
      return response.data;
    },
    enabled: !!owner && !!repo,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function usePullRequests(
  owner?: string, 
  repo?: string, 
  state: 'open' | 'closed' | 'all' = 'open'
) {
  return useQuery({
    queryKey: ['github', 'pull-requests', { owner, repo, state }],
    queryFn: async () => {
      const params = new URLSearchParams({ state });
      if (owner) params.set('owner', owner);
      if (repo) params.set('repo', repo);
      
      const response = await api.get(`github/pull-requests?${params}`).json<{
        success: boolean;
        data: PullRequest[];
      }>();
      return response.data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

export function useCreatePullRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: CreatePRParams) => {
      const response = await api.post('github/pull-requests', {
        json: params,
      }).json<{
        success: boolean;
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
