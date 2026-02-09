import type { GitHubRepository, GitHubBranch, GitHubFileTreeEntry, GitHubFileContent, GitHubUpdateFileRequest, GitHubUpdateFileResponse, GitHubServiceConfig } from '../types';
/**
 * GitHubService
 *
 * Handles all GitHub API operations for the GitOps portal
 * Includes mock data mode for development without GitHub token
 */
export declare class GitHubService {
    private octokit?;
    private config;
    private useMockData;
    constructor(config: GitHubServiceConfig);
    /**
     * List repositories in the organization
     */
    listRepositories(filter?: string): Promise<GitHubRepository[]>;
    /**
     * List branches for a repository
     */
    listBranches(repository: string, filter?: string): Promise<GitHubBranch[]>;
    /**
     * Get file tree for a repository branch
     */
    getFileTree(repository: string, branch: string, path?: string): Promise<GitHubFileTreeEntry[]>;
    /**
     * Get file content
     */
    getFileContent(repository: string, branch: string, path: string): Promise<GitHubFileContent>;
    /**
     * Update file content and commit
     */
    updateFile(request: GitHubUpdateFileRequest): Promise<GitHubUpdateFileResponse>;
    /**
     * Compare two branches and get diff
     */
    compareBranches(repository: string, base: string, head: string): Promise<any>;
    /**
     * Create a pull request
     */
    createPullRequest(repository: string, title: string, head: string, base: string, body?: string): Promise<any>;
    /**
     * Create a new branch from an existing branch
     */
    createBranch(repository: string, newBranchName: string, fromBranch: string): Promise<any>;
    /**
     * List pull requests
     */
    listPullRequests(repository: string, state?: 'open' | 'closed' | 'all', sort?: 'created' | 'updated' | 'popularity' | 'long-running', direction?: 'asc' | 'desc'): Promise<any[]>;
    /**
     * Get pull request details
     */
    getPullRequest(repository: string, pullNumber: number): Promise<any>;
    /**
     * Get files changed in a pull request
     */
    getPullRequestFiles(repository: string, pullNumber: number): Promise<any[]>;
    /**
     * Merge a pull request
     */
    mergePullRequest(repository: string, pullNumber: number, commitTitle?: string, commitMessage?: string, mergeMethod?: 'merge' | 'squash' | 'rebase'): Promise<any>;
    /**
     * Add reviewers to a pull request
     */
    addReviewers(repository: string, pullNumber: number, reviewers: string[], teamReviewers?: string[]): Promise<any>;
    /**
     * Assign pull request to users
     */
    assignPullRequest(repository: string, pullNumber: number, assignees: string[]): Promise<any>;
    /**
     * Get PR comments
     */
    getPullRequestComments(repository: string, pullNumber: number): Promise<any[]>;
    /**
     * Add comment to PR
     */
    addPullRequestComment(repository: string, pullNumber: number, body: string): Promise<any>;
    /**
     * Get PR status checks
     */
    getPullRequestStatusChecks(repository: string, pullNumber: number): Promise<any[]>;
    /**
     * Get PR reviews
     */
    getPullRequestReviews(repository: string, pullNumber: number): Promise<any[]>;
    /**
     * Get PR timeline events
     */
    getPullRequestTimeline(repository: string, pullNumber: number): Promise<any[]>;
    private getMockRepositories;
    private getMockBranches;
    private getMockFileTree;
    private getMockFileContent;
    private getMockUpdateFileResponse;
    private getMockComparison;
    private getMockPullRequest;
    private getMockCreateBranch;
    private getMockPullRequests;
    private getMockPullRequestDetails;
    private getMockPullRequestFiles;
    private getMockMergeResult;
    private getMockAddReviewersResult;
    private getMockAssignResult;
    private getMockComments;
    private getMockAddComment;
    private getMockStatusChecks;
    private getMockReviews;
    private getMockTimeline;
}
//# sourceMappingURL=GitHubService.d.ts.map