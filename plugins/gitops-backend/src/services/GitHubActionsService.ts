import { Config } from '@backstage/config';
import { Logger } from 'winston';

interface WorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'neutral' | 'timed_out' | 'action_required' | null;
  workflow_id: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_started_at: string;
  actor: {
    login: string;
    avatar_url: string;
  };
  triggering_actor?: {
    login: string;
    avatar_url: string;
  };
  event: string;
  run_attempt: number;
  run_number: number;
}

interface Workflow {
  id: number;
  name: string;
  path: string;
  state: 'active' | 'disabled_manually' | 'disabled_inactivity';
  html_url: string;
  badge_url: string;
}

interface WorkflowJob {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: string | null;
  started_at: string;
  completed_at: string | null;
  html_url: string;
  steps: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    number: number;
    started_at: string;
    completed_at: string | null;
  }>;
}

export interface GitHubActionsConfig {
  token: string;
  organization: string;
  apiBaseUrl?: string;
}

export class GitHubActionsService {
  private config: GitHubActionsConfig;
  private logger: Logger;
  private baseUrl: string;

  constructor(config: Config, logger: Logger) {
    this.logger = logger;
    
    const gitopsConfig = config.getOptionalConfig('gitops.github');
    this.config = {
      token: gitopsConfig?.getString('token') || process.env.GITHUB_TOKEN || '',
      organization: gitopsConfig?.getString('organization') || process.env.GITHUB_ORG || '',
      apiBaseUrl: gitopsConfig?.getOptionalString('apiBaseUrl'),
    };
    
    this.baseUrl = this.config.apiBaseUrl || 'https://api.github.com';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`GitHub Actions API error: ${response.status} - ${error}`);
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * List all workflows for a repository
   */
  async listWorkflows(repo: string): Promise<Workflow[]> {
    const owner = this.config.organization;
    const response = await this.request<{ workflows: Workflow[] }>(
      `/repos/${owner}/${repo}/actions/workflows`
    );
    return response.workflows;
  }

  /**
   * Get workflow runs for a repository
   */
  async getWorkflowRuns(
    repo: string,
    options: {
      workflow_id?: number;
      branch?: string;
      status?: string;
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<{ runs: WorkflowRun[]; total_count: number }> {
    const owner = this.config.organization;
    const params = new URLSearchParams();
    
    if (options.workflow_id) params.append('workflow_id', options.workflow_id.toString());
    if (options.branch) params.append('branch', options.branch);
    if (options.status) params.append('status', options.status);
    params.append('per_page', (options.per_page || 10).toString());
    params.append('page', (options.page || 1).toString());

    const endpoint = options.workflow_id
      ? `/repos/${owner}/${repo}/actions/workflows/${options.workflow_id}/runs?${params}`
      : `/repos/${owner}/${repo}/actions/runs?${params}`;

    const response = await this.request<{ workflow_runs: WorkflowRun[]; total_count: number }>(endpoint);
    
    return {
      runs: response.workflow_runs,
      total_count: response.total_count,
    };
  }

  /**
   * Get a specific workflow run
   */
  async getWorkflowRun(repo: string, runId: number): Promise<WorkflowRun> {
    const owner = this.config.organization;
    return this.request<WorkflowRun>(`/repos/${owner}/${repo}/actions/runs/${runId}`);
  }

  /**
   * Get jobs for a workflow run
   */
  async getWorkflowRunJobs(repo: string, runId: number): Promise<WorkflowJob[]> {
    const owner = this.config.organization;
    const response = await this.request<{ jobs: WorkflowJob[] }>(
      `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`
    );
    return response.jobs;
  }

  /**
   * Get workflow run logs URL (redirects to download)
   */
  async getWorkflowRunLogsUrl(repo: string, runId: number): Promise<string> {
    const owner = this.config.organization;
    return `${this.baseUrl}/repos/${owner}/${repo}/actions/runs/${runId}/logs`;
  }

  /**
   * Re-run a workflow
   */
  async rerunWorkflow(repo: string, runId: number): Promise<void> {
    const owner = this.config.organization;
    await this.request(`/repos/${owner}/${repo}/actions/runs/${runId}/rerun`, {
      method: 'POST',
    });
  }

  /**
   * Re-run failed jobs in a workflow
   */
  async rerunFailedJobs(repo: string, runId: number): Promise<void> {
    const owner = this.config.organization;
    await this.request(`/repos/${owner}/${repo}/actions/runs/${runId}/rerun-failed-jobs`, {
      method: 'POST',
    });
  }

  /**
   * Cancel a workflow run
   */
  async cancelWorkflowRun(repo: string, runId: number): Promise<void> {
    const owner = this.config.organization;
    await this.request(`/repos/${owner}/${repo}/actions/runs/${runId}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * Trigger a workflow dispatch event
   */
  async triggerWorkflow(
    repo: string,
    workflowId: number | string,
    ref: string,
    inputs?: Record<string, string>
  ): Promise<void> {
    const owner = this.config.organization;
    await this.request(`/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref, inputs: inputs || {} }),
    });
  }

  /**
   * Get build status summary for a repository
   */
  async getBuildStatusSummary(repo: string, branch?: string): Promise<{
    lastRun: WorkflowRun | null;
    recentRuns: WorkflowRun[];
    stats: {
      total: number;
      success: number;
      failed: number;
      cancelled: number;
      inProgress: number;
    };
  }> {
    const { runs, total_count } = await this.getWorkflowRuns(repo, {
      branch,
      per_page: 10,
    });

    const stats = {
      total: total_count,
      success: 0,
      failed: 0,
      cancelled: 0,
      inProgress: 0,
    };

    for (const run of runs) {
      if (run.status === 'in_progress' || run.status === 'queued') {
        stats.inProgress++;
      } else if (run.conclusion === 'success') {
        stats.success++;
      } else if (run.conclusion === 'failure') {
        stats.failed++;
      } else if (run.conclusion === 'cancelled') {
        stats.cancelled++;
      }
    }

    return {
      lastRun: runs[0] || null,
      recentRuns: runs.slice(0, 5),
      stats,
    };
  }

  /**
   * Get workflow usage/billing for a repository (requires admin access)
   */
  async getWorkflowUsage(repo: string): Promise<{
    billable: {
      UBUNTU?: { total_ms: number };
      MACOS?: { total_ms: number };
      WINDOWS?: { total_ms: number };
    };
  } | null> {
    try {
      const owner = this.config.organization;
      return await this.request(`/repos/${owner}/${repo}/actions/workflows/usage`);
    } catch (error) {
      this.logger.warn(`Could not fetch workflow usage for ${repo}: ${error}`);
      return null;
    }
  }
}
