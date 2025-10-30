import express from 'express';
import Router from 'express-promise-router';
import { GitHubService } from '../services/GitHubService';
import { ArgoCDService } from '../services/ArgoCDService';
import { AuditService } from '../services/AuditService';
import { BulkOperationService } from '../services/BulkOperationService';
import { GrafanaService } from '../services/GrafanaService';
import { listRepositoriesSchema, listBranchesSchema, getFileTreeSchema, getFileContentSchema, updateFileSchema, listArgoCDAppsSchema, syncArgoCDAppSchema, getBulkOperationSchema, listBulkOperationsSchema, listAuditLogsSchema, validate, } from '../validation/schemas';
import { asyncHandler } from '../errors';
export async function createRouter(options) {
    const { logger, config, database } = options;
    const router = Router();
    router.use(express.json());
    // Get database connection
    const knex = await database.getClient();
    // Initialize services
    const githubToken = config.getOptionalString('gitops.github.token') || 'your_github_personal_access_token';
    const githubOrg = config.getOptionalString('gitops.github.organization') || 'radiantlogic-saas';
    const githubService = new GitHubService({
        token: githubToken,
        organization: githubOrg,
    });
    const argoCDUrl = config.getOptionalString('gitops.argocd.url') || 'http://localhost:8080';
    const argoCDToken = config.getOptionalString('gitops.argocd.token') || 'your_argocd_token';
    const argoCDNamespace = config.getOptionalString('gitops.argocd.namespace') || 'duploservices-rli-use2-svc';
    const argoCDService = new ArgoCDService({
        url: argoCDUrl,
        token: argoCDToken,
        namespace: argoCDNamespace,
    });
    const grafanaUrl = config.getOptionalString('gitops.grafana.url') || '';
    const grafanaToken = config.getOptionalString('gitops.grafana.token') || '';
    const grafanaEnabled = config.getOptionalBoolean('gitops.grafana.enabled') || false;
    let grafanaService = null;
    if (grafanaEnabled && grafanaUrl && grafanaToken) {
        grafanaService = new GrafanaService({
            url: grafanaUrl,
            token: grafanaToken,
        });
        logger.info(`Grafana integration enabled: ${grafanaUrl}`);
    }
    else {
        logger.info('Grafana integration disabled or not configured');
    }
    const auditService = new AuditService({ database: knex });
    const bulkOperationService = new BulkOperationService(knex, githubService, auditService);
    logger.info('GitOps backend plugin initializing with all services');
    // Health check endpoint
    router.get('/health', (_, response) => {
        logger.info('Health check requested');
        response.json({ status: 'ok' });
    });
    // ===========================================================================
    // Repository Operations
    // ===========================================================================
    /**
     * GET /repositories
     * List all repositories in the organization
     */
    router.get('/repositories', asyncHandler(async (req, res) => {
        logger.info('GET /repositories');
        // Validate request
        const params = validate(listRepositoriesSchema, req.query);
        // Fetch repositories
        const repositories = await githubService.listRepositories(params.filter);
        res.json({
            repositories,
            total: repositories.length,
        });
    }));
    /**
     * GET /repositories/:repo/branches
     * List all branches for a repository
     */
    router.get('/repositories/:repo/branches', asyncHandler(async (req, res) => {
        const { repo } = req.params;
        logger.info(`GET /repositories/${repo}/branches`);
        // Validate request
        const params = validate(listBranchesSchema, {
            repository: repo,
            ...req.query,
        });
        // Fetch branches
        const branches = await githubService.listBranches(params.repository, params.filter);
        res.json({
            branches,
            total: branches.length,
        });
    }));
    /**
     * GET /repositories/:repo/tree
     * Get file tree for a repository branch
     */
    router.get('/repositories/:repo/tree', asyncHandler(async (req, res) => {
        const { repo } = req.params;
        const { branch, path } = req.query;
        logger.info(`GET /repositories/${repo}/tree - branch: ${branch}, path: ${path}`);
        // Validate request
        const params = validate(getFileTreeSchema, {
            repository: repo,
            branch: branch,
            path: path,
        });
        // Fetch file tree
        const entries = await githubService.getFileTree(params.repository, params.branch, params.path || '');
        res.json({
            entries,
            path: params.path || '',
        });
    }));
    /**
     * GET /repositories/:repo/content
     * Get file content from a repository branch
     */
    router.get('/repositories/:repo/content', asyncHandler(async (req, res) => {
        const { repo } = req.params;
        const { branch, path } = req.query;
        logger.info(`GET /repositories/${repo}/content - branch: ${branch}, path: ${path}`);
        // Validate request
        const params = validate(getFileContentSchema, {
            repository: repo,
            branch: branch,
            path: path,
        });
        // Fetch file content
        const fileContent = await githubService.getFileContent(params.repository, params.branch, params.path);
        // Decode base64 content
        const decodedContent = Buffer.from(fileContent.content, 'base64').toString('utf-8');
        res.json({
            content: decodedContent,
            sha: fileContent.sha,
            path: fileContent.path,
            branch: params.branch,
            size: fileContent.size,
            name: fileContent.name,
        });
    }));
    // ===========================================================================
    // File Update Operations
    // ===========================================================================
    /**
     * POST /repositories/:repo/files/update
     * Update file across multiple branches
     */
    router.post('/repositories/:repo/files/update', asyncHandler(async (req, res) => {
        const { repo } = req.params;
        logger.info(`POST /repositories/${repo}/files/update`);
        // Validate request
        const params = validate(updateFileSchema, {
            repository: repo,
            ...req.body,
        });
        // Create bulk update operation
        const operationId = await bulkOperationService.createBulkUpdate({
            user_id: 'default-user',
            repository: params.repository,
            branches: params.branches,
            file_path: params.path,
            content: params.content,
            message: params.message,
            committer: params.committer,
            fieldPath: params.fieldPath,
            fieldValue: params.fieldValue,
        });
        res.status(202).json({
            operation_id: operationId,
            status: 'pending',
            total_branches: params.branches.length,
            message: 'Bulk update operation initiated',
        });
    }));
    // ===========================================================================
    // Bulk Operations
    // ===========================================================================
    /**
     * GET /bulk-operations/:operation_id
     * Get bulk operation status
     */
    router.get('/bulk-operations/:operation_id', asyncHandler(async (req, res) => {
        const { operation_id } = req.params;
        logger.info(`GET /bulk-operations/${operation_id}`);
        // Validate request
        const params = validate(getBulkOperationSchema, {
            operation_id,
        });
        // Get operation
        const operation = await bulkOperationService.getOperation(params.operation_id);
        if (!operation) {
            res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: `Bulk operation ${operation_id} not found`,
                },
            });
            return;
        }
        res.json({ operation });
    }));
    /**
     * GET /bulk-operations
     * List bulk operations with filters
     */
    router.get('/bulk-operations', asyncHandler(async (req, res) => {
        logger.info('GET /bulk-operations');
        // Validate request
        const params = validate(listBulkOperationsSchema, req.query);
        // Get operations
        const { operations, total } = await bulkOperationService.listOperations(params);
        res.json({
            operations,
            total,
            limit: params.limit || 20,
            offset: params.offset || 0,
        });
    }));
    // ===========================================================================
    // Audit Logs
    // ===========================================================================
    /**
     * GET /audit-logs
     * List audit logs with filters
     */
    router.get('/audit-logs', asyncHandler(async (req, res) => {
        logger.info('GET /audit-logs');
        // Validate request
        const params = validate(listAuditLogsSchema, req.query);
        // Convert date strings to Date objects
        const filters = {
            ...params,
            start_date: params.start_date ? new Date(params.start_date) : undefined,
            end_date: params.end_date ? new Date(params.end_date) : undefined,
        };
        // Get logs
        const { logs, total } = await auditService.getLogs(filters);
        res.json({
            logs,
            total,
            limit: params.limit || 100,
            offset: params.offset || 0,
        });
    }));
    // ===========================================================================
    // ArgoCD Operations
    // ===========================================================================
    /**
     * GET /argocd/applications
     * List ArgoCD applications
     */
    router.get('/argocd/applications', asyncHandler(async (req, res) => {
        logger.info('GET /argocd/applications');
        // Validate request
        const params = validate(listArgoCDAppsSchema, req.query);
        // Get applications
        let applications = await argoCDService.listApplications(params.filter);
        // Filter by branch if specified
        if (params.branch) {
            applications = applications.filter(app => app.spec.source.targetRevision === params.branch);
        }
        res.json({
            applications,
            total: applications.length,
        });
    }));
    /**
     * GET /argocd/applications/:appName
     * Get specific ArgoCD application
     */
    router.get('/argocd/applications/:appName', asyncHandler(async (req, res) => {
        const { appName } = req.params;
        logger.info(`GET /argocd/applications/${appName}`);
        // Get application
        const application = await argoCDService.getApplication(appName);
        res.json({ application });
    }));
    /**
     * POST /argocd/sync
     * Sync ArgoCD applications
     */
    router.post('/argocd/sync', asyncHandler(async (req, res) => {
        logger.info('POST /argocd/sync');
        // Validate request
        const params = validate(syncArgoCDAppSchema, req.body);
        // Sync applications
        const results = await argoCDService.syncApplications(params.applications, {
            prune: params.prune,
            dryRun: params.dryRun,
        });
        // Log to audit
        for (const result of results) {
            await auditService.logSync({
                user_id: 'default-user',
                resource_type: 'argocd_app',
                resource_id: result.application,
                argocd_app_name: result.application,
                sync_status: result.status,
                status: result.status === 'Syncing' || result.status === 'Synced' ? 'success' : 'failure',
                error_message: result.status !== 'Syncing' && result.status !== 'Synced' ? result.message : undefined,
            });
        }
        res.json({
            results,
            total: results.length,
            successful: results.filter(r => r.status === 'Syncing' || r.status === 'Synced').length,
            failed: results.filter(r => r.status !== 'Syncing' && r.status !== 'Synced').length,
        });
    }));
    // ===========================================================================
    // Grafana Operations
    // ===========================================================================
    /**
     * GET /grafana/dashboards
     * List all Grafana dashboards
     */
    router.get('/grafana/dashboards', asyncHandler(async (req, res) => {
        logger.info('GET /grafana/dashboards');
        if (!grafanaService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Grafana integration is not enabled or configured',
                },
            });
            return;
        }
        const dashboards = await grafanaService.listDashboards();
        res.json({
            dashboards,
            total: dashboards.length,
        });
    }));
    /**
     * GET /grafana/dashboards/:uid
     * Get specific Grafana dashboard
     */
    router.get('/grafana/dashboards/:uid', asyncHandler(async (req, res) => {
        const { uid } = req.params;
        logger.info(`GET /grafana/dashboards/${uid}`);
        if (!grafanaService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Grafana integration is not enabled or configured',
                },
            });
            return;
        }
        const dashboard = await grafanaService.getDashboard(uid);
        res.json({ dashboard });
    }));
    /**
     * GET /grafana/folders
     * List all Grafana folders
     */
    router.get('/grafana/folders', asyncHandler(async (req, res) => {
        logger.info('GET /grafana/folders');
        if (!grafanaService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Grafana integration is not enabled or configured',
                },
            });
            return;
        }
        const folders = await grafanaService.listFolders();
        res.json({
            folders,
            total: folders.length,
        });
    }));
    /**
     * GET /grafana/search
     * Search Grafana dashboards
     */
    router.get('/grafana/search', asyncHandler(async (req, res) => {
        const { query } = req.query;
        logger.info(`GET /grafana/search?query=${query}`);
        if (!grafanaService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Grafana integration is not enabled or configured',
                },
            });
            return;
        }
        const dashboards = await grafanaService.searchDashboards(query || '');
        res.json({
            dashboards,
            total: dashboards.length,
        });
    }));
    // ===========================================================================
    // Pull Request Operations
    // ===========================================================================
    /**
     * GET /repositories/:repo/compare/:base...:head
     * Compare two branches and get diff
     */
    router.get('/repositories/:repo/compare/:base...:head', asyncHandler(async (req, res) => {
        const { repo, base, head } = req.params;
        logger.info(`GET /repositories/${repo}/compare/${base}...${head}`);
        const comparison = await githubService.compareBranches(repo, base, head);
        res.json({ comparison });
    }));
    /**
     * GET /repositories/:repo/pulls
     * List pull requests
     */
    router.get('/repositories/:repo/pulls', asyncHandler(async (req, res) => {
        const { repo } = req.params;
        const { state, sort, direction } = req.query;
        logger.info(`GET /repositories/${repo}/pulls?state=${state}`);
        const pulls = await githubService.listPullRequests(repo, state || 'open', sort || 'created', direction || 'desc');
        res.json({
            pulls,
            total: pulls.length,
        });
    }));
    /**
     * POST /repositories/:repo/pulls
     * Create a pull request
     */
    router.post('/repositories/:repo/pulls', asyncHandler(async (req, res) => {
        const { repo } = req.params;
        const { title, body, head, base } = req.body;
        logger.info(`POST /repositories/${repo}/pulls - Creating PR from ${head} to ${base}`);
        if (!title || !head || !base) {
            res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required fields: title, head, base',
                },
            });
            return;
        }
        const pull = await githubService.createPullRequest(repo, title, head, base, body);
        res.status(201).json({ pull });
    }));
    /**
     * GET /repositories/:repo/pulls/:number
     * Get pull request details
     */
    router.get('/repositories/:repo/pulls/:number', asyncHandler(async (req, res) => {
        const { repo, number } = req.params;
        logger.info(`GET /repositories/${repo}/pulls/${number}`);
        const pull = await githubService.getPullRequest(repo, parseInt(number, 10));
        res.json({ pull });
    }));
    /**
     * GET /repositories/:repo/pulls/:number/files
     * Get files changed in a pull request (with diff)
     */
    router.get('/repositories/:repo/pulls/:number/files', asyncHandler(async (req, res) => {
        const { repo, number } = req.params;
        logger.info(`GET /repositories/${repo}/pulls/${number}/files`);
        const files = await githubService.getPullRequestFiles(repo, parseInt(number, 10));
        res.json({
            files,
            total: files.length,
        });
    }));
    /**
     * POST /repositories/:repo/pulls/:number/merge
     * Merge a pull request
     */
    router.post('/repositories/:repo/pulls/:number/merge', asyncHandler(async (req, res) => {
        const { repo, number } = req.params;
        const { commit_title, commit_message, merge_method } = req.body;
        logger.info(`POST /repositories/${repo}/pulls/${number}/merge`);
        const result = await githubService.mergePullRequest(repo, parseInt(number, 10), commit_title, commit_message, merge_method || 'merge');
        // Log to audit
        await auditService.log({
            user_id: 'default-user',
            operation: 'commit',
            resource_type: 'repository',
            resource_id: repo,
            repository: repo,
            metadata: {
                action: 'merge_pull_request',
                pull_number: number,
                merge_method: merge_method || 'merge',
            },
            status: result.merged ? 'success' : 'failure',
        });
        res.json({ result });
    }));
    /**
     * POST /repositories/:repo/pulls/:number/reviewers
     * Add reviewers to a pull request
     */
    router.post('/repositories/:repo/pulls/:number/reviewers', asyncHandler(async (req, res) => {
        const { repo, number } = req.params;
        const { reviewers, team_reviewers } = req.body;
        logger.info(`POST /repositories/${repo}/pulls/${number}/reviewers`);
        if (!reviewers || !Array.isArray(reviewers)) {
            res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'reviewers must be an array of usernames',
                },
            });
            return;
        }
        const result = await githubService.addReviewers(repo, parseInt(number, 10), reviewers, team_reviewers);
        res.json({ result });
    }));
    /**
     * POST /repositories/:repo/pulls/:number/assignees
     * Assign pull request to users
     */
    router.post('/repositories/:repo/pulls/:number/assignees', asyncHandler(async (req, res) => {
        const { repo, number } = req.params;
        const { assignees } = req.body;
        logger.info(`POST /repositories/${repo}/pulls/${number}/assignees`);
        if (!assignees || !Array.isArray(assignees)) {
            res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'assignees must be an array of usernames',
                },
            });
            return;
        }
        const result = await githubService.assignPullRequest(repo, parseInt(number, 10), assignees);
        res.json({ result });
    }));
    logger.info('GitOps backend plugin initialized with all endpoints');
    return router;
}
//# sourceMappingURL=router.js.map