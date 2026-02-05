import express from 'express';
import Router from 'express-promise-router';
import { GitHubService } from '../services/GitHubService';
import { ArgoCDService } from '../services/ArgoCDService';
import { AuditService } from '../services/AuditService';
import { BulkOperationService } from '../services/BulkOperationService';
import { GrafanaService } from '../services/GrafanaService';
import { HealthService } from '../services/HealthService';
import { GitLabService } from '../services/GitLabService';
import { UptimeKumaService } from '../services/UptimeKumaService';
import { AuthTokenService } from '../services/AuthTokenService';
import { listRepositoriesSchema, listBranchesSchema, getFileTreeSchema, getFileContentSchema, updateFileSchema, listArgoCDAppsSchema, syncArgoCDAppSchema, getBulkOperationSchema, listBulkOperationsSchema, listAuditLogsSchema, validate, } from '../validation/schemas';
import { asyncHandler } from '../errors';
import { requestLoggerMiddleware, getUserContext } from '../middleware/requestLogger';
import { generalRateLimiter, bulkOperationsRateLimiter, syncRateLimiter } from '../middleware/rateLimiter';
import { securityHeadersMiddleware } from '../middleware/securityHeaders';
export async function createRouter(options) {
    const { logger, config, database } = options;
    const router = Router();
    // Security middleware
    router.use(securityHeadersMiddleware());
    router.use(express.json({ limit: '10mb' })); // Limit request body size
    router.use(requestLoggerMiddleware());
    router.use(generalRateLimiter);
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
    // Initialize GitLab service
    const gitlabEnabled = config.getOptionalBoolean('gitops.gitlab.enabled') || false;
    const gitlabUrl = config.getOptionalString('gitops.gitlab.baseUrl') || 'https://gitlab.com';
    const gitlabToken = config.getOptionalString('gitops.gitlab.token') || '';
    let gitlabService = null;
    if (gitlabEnabled && gitlabToken) {
        gitlabService = new GitLabService({
            baseUrl: gitlabUrl,
            token: gitlabToken,
        });
        logger.info(`GitLab integration enabled: ${gitlabUrl}`);
    }
    else {
        logger.info('GitLab integration disabled or not configured');
    }
    // Initialize Uptime Kuma service
    const uptimeKumaEnabled = config.getOptionalBoolean('gitops.uptimeKuma.enabled') || false;
    const uptimeKumaUrl = config.getOptionalString('gitops.uptimeKuma.baseUrl') || '';
    const uptimeKumaApiKey = config.getOptionalString('gitops.uptimeKuma.apiKey') || '';
    let uptimeKumaService = null;
    if (uptimeKumaEnabled && uptimeKumaUrl) {
        uptimeKumaService = new UptimeKumaService({
            baseUrl: uptimeKumaUrl,
            apiKey: uptimeKumaApiKey,
        });
        logger.info(`Uptime Kuma integration enabled: ${uptimeKumaUrl}`);
    }
    else {
        logger.info('Uptime Kuma integration disabled or not configured');
    }
    // Initialize Auth Token service for OAuth-based access
    const allowUnauthenticated = config.getOptionalBoolean('gitops.auth.allowUnauthenticated') ?? true;
    const authTokenService = new AuthTokenService({
        fallbackGitHubToken: githubToken,
        fallbackGitLabToken: gitlabToken,
        allowUnauthenticated,
    });
    const auditService = new AuditService({ database: knex });
    const bulkOperationService = new BulkOperationService(knex, githubService, auditService);
    // Initialize health service
    const healthService = new HealthService({
        database: knex,
        githubToken: githubToken,
        githubOrg: githubOrg,
        argoCDUrl: argoCDUrl,
        argoCDToken: argoCDToken,
        grafanaUrl: grafanaUrl,
        grafanaToken: grafanaToken,
    });
    logger.info('GitOps backend plugin initializing with all services');
    // ===========================================================================
    // Health Check Endpoints
    // ===========================================================================
    /**
     * GET /health
     * Comprehensive health check with dependency status
     */
    router.get('/health', asyncHandler(async (req, res) => {
        const detailed = req.query.detailed === 'true';
        if (detailed) {
            const health = await healthService.getHealth();
            res.status(health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503)
                .json(health);
        }
        else {
            res.json({ status: 'ok' });
        }
    }));
    /**
     * GET /health/live
     * Kubernetes liveness probe - is the service running?
     */
    router.get('/health/live', asyncHandler(async (_, res) => {
        const liveness = await healthService.getLiveness();
        res.json(liveness);
    }));
    /**
     * GET /health/ready
     * Kubernetes readiness probe - is the service ready for traffic?
     */
    router.get('/health/ready', asyncHandler(async (_, res) => {
        const readiness = await healthService.getReadiness();
        res.status(readiness.ready ? 200 : 503).json(readiness);
    }));
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
     * Update file across multiple branches (BULK OPERATION)
     */
    router.post('/repositories/:repo/files/update', bulkOperationsRateLimiter, // Apply stricter rate limit for bulk ops
    asyncHandler(async (req, res) => {
        const { repo } = req.params;
        logger.info(`POST /repositories/${repo}/files/update`);
        // Validate request
        const params = validate(updateFileSchema, {
            repository: repo,
            ...req.body,
        });
        // Get user context from request
        const userContext = getUserContext(req);
        // Create bulk update operation
        const operationId = await bulkOperationService.createBulkUpdate({
            user_id: userContext.userId,
            user_email: userContext.userEmail,
            repository: params.repository,
            branches: params.branches,
            file_path: params.path,
            content: params.content,
            message: params.message,
            committer: params.committer,
            fieldPath: params.fieldPath,
            fieldValue: params.fieldValue,
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
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
    router.post('/argocd/sync', syncRateLimiter, // Apply sync-specific rate limit
    asyncHandler(async (req, res) => {
        logger.info('POST /argocd/sync');
        // Validate request
        const params = validate(syncArgoCDAppSchema, req.body);
        // Sync applications
        const results = await argoCDService.syncApplications(params.applications, {
            prune: params.prune,
            dryRun: params.dryRun,
        });
        // Get user context and log to audit
        const userContext = getUserContext(req);
        for (const result of results) {
            await auditService.logSync({
                user_id: userContext.userId,
                user_email: userContext.userEmail,
                resource_type: 'argocd_app',
                resource_id: result.application,
                argocd_app_name: result.application,
                sync_status: result.status,
                status: result.status === 'Syncing' || result.status === 'Synced' ? 'success' : 'failure',
                error_message: result.status !== 'Syncing' && result.status !== 'Synced' ? result.message : undefined,
                ip_address: req.ip,
                user_agent: req.headers['user-agent'],
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
    // GitLab Operations
    // ===========================================================================
    /**
     * GET /gitlab/projects
     * List GitLab projects
     */
    router.get('/gitlab/projects', asyncHandler(async (req, res) => {
        logger.info('GET /gitlab/projects');
        if (!gitlabService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'GitLab integration is not enabled or configured',
                },
            });
            return;
        }
        const { search, page, per_page } = req.query;
        const projects = await gitlabService.listProjects({
            search: search,
            page: page ? parseInt(page, 10) : undefined,
            perPage: per_page ? parseInt(per_page, 10) : undefined,
        });
        res.json({
            projects,
            total: projects.length,
        });
    }));
    /**
     * GET /gitlab/projects/:projectId
     * Get GitLab project details
     */
    router.get('/gitlab/projects/:projectId', asyncHandler(async (req, res) => {
        const { projectId } = req.params;
        logger.info(`GET /gitlab/projects/${projectId}`);
        if (!gitlabService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'GitLab integration is not enabled or configured',
                },
            });
            return;
        }
        const project = await gitlabService.getProject(projectId);
        res.json({ project });
    }));
    /**
     * GET /gitlab/projects/:projectId/branches
     * List GitLab project branches
     */
    router.get('/gitlab/projects/:projectId/branches', asyncHandler(async (req, res) => {
        const { projectId } = req.params;
        logger.info(`GET /gitlab/projects/${projectId}/branches`);
        if (!gitlabService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'GitLab integration is not enabled or configured',
                },
            });
            return;
        }
        const branches = await gitlabService.listBranches(projectId);
        res.json({ branches, total: branches.length });
    }));
    /**
     * GET /gitlab/projects/:projectId/tree
     * Get GitLab project file tree
     */
    router.get('/gitlab/projects/:projectId/tree', asyncHandler(async (req, res) => {
        const { projectId } = req.params;
        const { ref, path, recursive } = req.query;
        logger.info(`GET /gitlab/projects/${projectId}/tree`);
        if (!gitlabService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'GitLab integration is not enabled or configured',
                },
            });
            return;
        }
        const tree = await gitlabService.getTree(projectId, {
            ref: ref,
            path: path,
            recursive: recursive === 'true',
        });
        res.json({ tree, total: tree.length });
    }));
    /**
     * GET /gitlab/projects/:projectId/files
     * Get GitLab file content
     */
    router.get('/gitlab/projects/:projectId/files', asyncHandler(async (req, res) => {
        const { projectId } = req.params;
        const { path, ref } = req.query;
        logger.info(`GET /gitlab/projects/${projectId}/files?path=${path}`);
        if (!gitlabService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'GitLab integration is not enabled or configured',
                },
            });
            return;
        }
        if (!path) {
            res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'path is required' },
            });
            return;
        }
        const file = await gitlabService.getFile(projectId, path, ref);
        const content = Buffer.from(file.content, 'base64').toString('utf-8');
        res.json({ ...file, decodedContent: content });
    }));
    /**
     * PUT /gitlab/projects/:projectId/files
     * Update GitLab file
     */
    router.put('/gitlab/projects/:projectId/files', asyncHandler(async (req, res) => {
        const { projectId } = req.params;
        const { path, content, branch, commitMessage } = req.body;
        logger.info(`PUT /gitlab/projects/${projectId}/files`);
        if (!gitlabService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'GitLab integration is not enabled or configured',
                },
            });
            return;
        }
        const result = await gitlabService.updateFile(projectId, path, content, {
            branch,
            commitMessage,
        });
        // Audit log
        const userContext = getUserContext(req);
        await auditService.log({
            user_id: userContext.userId,
            user_email: userContext.userEmail,
            operation: 'commit',
            resource_type: 'gitlab_file',
            resource_id: `${projectId}/${path}`,
            repository: projectId.toString(),
            branch,
            file_path: path,
            status: 'success',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
        });
        res.json({ result });
    }));
    /**
     * GET /gitlab/projects/:projectId/merge_requests
     * List GitLab merge requests
     */
    router.get('/gitlab/projects/:projectId/merge_requests', asyncHandler(async (req, res) => {
        const { projectId } = req.params;
        const { state } = req.query;
        logger.info(`GET /gitlab/projects/${projectId}/merge_requests`);
        if (!gitlabService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'GitLab integration is not enabled or configured',
                },
            });
            return;
        }
        const mergeRequests = await gitlabService.listMergeRequests(projectId, {
            state: state,
        });
        res.json({ mergeRequests, total: mergeRequests.length });
    }));
    /**
     * POST /gitlab/projects/:projectId/merge_requests
     * Create GitLab merge request
     */
    router.post('/gitlab/projects/:projectId/merge_requests', asyncHandler(async (req, res) => {
        const { projectId } = req.params;
        const { sourceBranch, targetBranch, title, description } = req.body;
        logger.info(`POST /gitlab/projects/${projectId}/merge_requests`);
        if (!gitlabService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'GitLab integration is not enabled or configured',
                },
            });
            return;
        }
        const mergeRequest = await gitlabService.createMergeRequest(projectId, {
            sourceBranch,
            targetBranch,
            title,
            description,
        });
        res.status(201).json({ mergeRequest });
    }));
    /**
     * GET /gitlab/projects/:projectId/pipelines
     * List GitLab pipelines
     */
    router.get('/gitlab/projects/:projectId/pipelines', asyncHandler(async (req, res) => {
        const { projectId } = req.params;
        const { ref, status } = req.query;
        logger.info(`GET /gitlab/projects/${projectId}/pipelines`);
        if (!gitlabService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'GitLab integration is not enabled or configured',
                },
            });
            return;
        }
        const pipelines = await gitlabService.listPipelines(projectId, {
            ref: ref,
            status: status,
        });
        res.json({ pipelines, total: pipelines.length });
    }));
    /**
     * GET /gitlab/health
     * Check GitLab service health
     */
    router.get('/gitlab/health', asyncHandler(async (_, res) => {
        if (!gitlabService) {
            res.json({ healthy: false, message: 'GitLab integration not configured' });
            return;
        }
        const health = await gitlabService.healthCheck();
        res.json(health);
    }));
    // ===========================================================================
    // Uptime Kuma Operations
    // ===========================================================================
    /**
     * GET /uptime-kuma/monitors
     * List all Uptime Kuma monitors
     */
    router.get('/uptime-kuma/monitors', asyncHandler(async (req, res) => {
        logger.info('GET /uptime-kuma/monitors');
        if (!uptimeKumaService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Uptime Kuma integration is not enabled or configured',
                },
            });
            return;
        }
        const monitors = await uptimeKumaService.getMonitors();
        res.json({ monitors, total: monitors.length });
    }));
    /**
     * GET /uptime-kuma/monitors/:id
     * Get Uptime Kuma monitor details with status
     */
    router.get('/uptime-kuma/monitors/:id', asyncHandler(async (req, res) => {
        const { id } = req.params;
        logger.info(`GET /uptime-kuma/monitors/${id}`);
        if (!uptimeKumaService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Uptime Kuma integration is not enabled or configured',
                },
            });
            return;
        }
        const status = await uptimeKumaService.getMonitorStatus(parseInt(id, 10));
        res.json(status);
    }));
    /**
     * GET /uptime-kuma/stats
     * Get Uptime Kuma overall statistics
     */
    router.get('/uptime-kuma/stats', asyncHandler(async (_, res) => {
        logger.info('GET /uptime-kuma/stats');
        if (!uptimeKumaService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Uptime Kuma integration is not enabled or configured',
                },
            });
            return;
        }
        const stats = await uptimeKumaService.getStats();
        res.json(stats);
    }));
    /**
     * GET /uptime-kuma/dashboard
     * Get Uptime Kuma dashboard summary
     */
    router.get('/uptime-kuma/dashboard', asyncHandler(async (_, res) => {
        logger.info('GET /uptime-kuma/dashboard');
        if (!uptimeKumaService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Uptime Kuma integration is not enabled or configured',
                },
            });
            return;
        }
        const summary = await uptimeKumaService.getDashboardSummary();
        res.json(summary);
    }));
    /**
     * GET /uptime-kuma/status-pages
     * List Uptime Kuma status pages
     */
    router.get('/uptime-kuma/status-pages', asyncHandler(async (_, res) => {
        logger.info('GET /uptime-kuma/status-pages');
        if (!uptimeKumaService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Uptime Kuma integration is not enabled or configured',
                },
            });
            return;
        }
        const statusPages = await uptimeKumaService.getStatusPages();
        res.json({ statusPages, total: statusPages.length });
    }));
    /**
     * GET /uptime-kuma/health
     * Check Uptime Kuma service health
     */
    router.get('/uptime-kuma/health', asyncHandler(async (_, res) => {
        if (!uptimeKumaService) {
            res.json({ healthy: false, message: 'Uptime Kuma integration not configured' });
            return;
        }
        const health = await uptimeKumaService.healthCheck();
        res.json(health);
    }));
    /**
     * POST /uptime-kuma/monitors/:id/pause
     * Pause a monitor
     */
    router.post('/uptime-kuma/monitors/:id/pause', asyncHandler(async (req, res) => {
        const { id } = req.params;
        logger.info(`POST /uptime-kuma/monitors/${id}/pause`);
        if (!uptimeKumaService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Uptime Kuma integration is not enabled or configured',
                },
            });
            return;
        }
        await uptimeKumaService.pauseMonitor(parseInt(id, 10));
        res.json({ success: true, message: `Monitor ${id} paused` });
    }));
    /**
     * POST /uptime-kuma/monitors/:id/resume
     * Resume a monitor
     */
    router.post('/uptime-kuma/monitors/:id/resume', asyncHandler(async (req, res) => {
        const { id } = req.params;
        logger.info(`POST /uptime-kuma/monitors/${id}/resume`);
        if (!uptimeKumaService) {
            res.status(503).json({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Uptime Kuma integration is not enabled or configured',
                },
            });
            return;
        }
        await uptimeKumaService.resumeMonitor(parseInt(id, 10));
        res.json({ success: true, message: `Monitor ${id} resumed` });
    }));
    // ===========================================================================
    // Auth Token Operations (for OAuth-based access)
    // ===========================================================================
    /**
     * GET /auth/user
     * Get current authenticated user info
     */
    router.get('/auth/user', asyncHandler(async (req, res) => {
        const user = await authTokenService.getUserFromRequest(req);
        if (!user) {
            res.json({ authenticated: false });
            return;
        }
        res.json({
            authenticated: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                provider: user.provider,
                hasGitHubToken: !!user.tokens.github,
                hasGitLabToken: !!user.tokens.gitlab,
            },
        });
    }));
    /**
     * GET /auth/organizations
     * Get organizations the user has access to
     */
    router.get('/auth/organizations', asyncHandler(async (req, res) => {
        const orgs = await authTokenService.getUserOrganizations(req);
        res.json({ organizations: orgs });
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
     * POST /repositories/:repo/branches
     * Create a new branch from an existing branch
     */
    router.post('/repositories/:repo/branches', asyncHandler(async (req, res) => {
        const { repo } = req.params;
        const { branch, from_branch } = req.body;
        logger.info(`POST /repositories/${repo}/branches - Creating branch "${branch}" from "${from_branch}"`);
        if (!branch || !from_branch) {
            res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required fields: branch, from_branch',
                },
            });
            return;
        }
        const result = await githubService.createBranch(repo, branch, from_branch);
        res.status(201).json({ branch: result });
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
     * POST /repositories/:repo/pulls/with-changes
     * Create a pull request with file changes (synchronous workflow)
     * This endpoint creates a new branch, commits changes, and creates a PR in one operation
     */
    router.post('/repositories/:repo/pulls/with-changes', asyncHandler(async (req, res) => {
        const { repo } = req.params;
        const { title, body, head, base, newBranchName, baseBranch, filePath, content, fieldPath, fieldValue, commitMessage, } = req.body;
        logger.info(`POST /repositories/${repo}/pulls/with-changes - Creating PR with changes`);
        // Validate required fields
        if (!title || !base || !newBranchName || !baseBranch || !filePath || !commitMessage) {
            res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required fields',
                },
            });
            return;
        }
        // Step 1: Create new branch
        await githubService.createBranch(repo, newBranchName, baseBranch);
        // Step 2: Get the file to obtain its SHA
        const fileContent = await githubService.getFileContent(repo, newBranchName, filePath);
        // Step 3: Prepare content for commit
        let contentToCommit;
        if (fieldPath && fieldValue) {
            // Field-level update: parse YAML, update field, serialize
            const { updateYamlField } = await import('../utils/yamlUtils');
            const currentContent = Buffer.from(fileContent.content, 'base64').toString('utf-8');
            contentToCommit = updateYamlField(currentContent, fieldPath, fieldValue);
        }
        else if (content) {
            // Full content update
            contentToCommit = content;
        }
        else {
            throw new Error('Either content or fieldPath/fieldValue must be provided');
        }
        // Step 4: Commit changes synchronously
        await githubService.updateFile({
            repository: repo,
            branch: newBranchName,
            path: filePath,
            content: Buffer.from(contentToCommit).toString('base64'),
            message: commitMessage,
            sha: fileContent.sha,
        });
        // Step 5: Create pull request
        const pull = await githubService.createPullRequest(repo, title, newBranchName, base, body);
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
        // Get user context and log to audit
        const userContext = getUserContext(req);
        await auditService.log({
            user_id: userContext.userId,
            user_email: userContext.userEmail,
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
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
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
    /**
     * GET /repositories/:repo/pulls/:number/comments
     * Get comments for a pull request
     */
    router.get('/repositories/:repo/pulls/:number/comments', asyncHandler(async (req, res) => {
        const { repo, number } = req.params;
        logger.info(`GET /repositories/${repo}/pulls/${number}/comments`);
        const comments = await githubService.getPullRequestComments(repo, parseInt(number, 10));
        res.json({ comments });
    }));
    /**
     * POST /repositories/:repo/pulls/:number/comments
     * Add a comment to a pull request
     */
    router.post('/repositories/:repo/pulls/:number/comments', asyncHandler(async (req, res) => {
        const { repo, number } = req.params;
        const { body } = req.body;
        logger.info(`POST /repositories/${repo}/pulls/${number}/comments`);
        if (!body || typeof body !== 'string') {
            res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'body is required and must be a string',
                },
            });
            return;
        }
        const comment = await githubService.addPullRequestComment(repo, parseInt(number, 10), body);
        // Get user context and log to audit
        const userContext = getUserContext(req);
        await auditService.log({
            user_id: userContext.userId,
            user_email: userContext.userEmail,
            operation: 'update',
            resource_type: 'repository',
            resource_id: `${repo}/pull/${number}`,
            repository: repo,
            branch: `PR #${number}`,
            metadata: { action: 'add_pr_comment', pull_number: number, comment_id: comment.id },
            status: 'success',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
        });
        res.status(201).json({ comment });
    }));
    /**
     * GET /repositories/:repo/pulls/:number/status-checks
     * Get status checks for a pull request
     */
    router.get('/repositories/:repo/pulls/:number/status-checks', asyncHandler(async (req, res) => {
        const { repo, number } = req.params;
        logger.info(`GET /repositories/${repo}/pulls/${number}/status-checks`);
        const checks = await githubService.getPullRequestStatusChecks(repo, parseInt(number, 10));
        res.json({ checks });
    }));
    /**
     * GET /repositories/:repo/pulls/:number/reviews
     * Get reviews for a pull request
     */
    router.get('/repositories/:repo/pulls/:number/reviews', asyncHandler(async (req, res) => {
        const { repo, number } = req.params;
        logger.info(`GET /repositories/${repo}/pulls/${number}/reviews`);
        const reviews = await githubService.getPullRequestReviews(repo, parseInt(number, 10));
        res.json({ reviews });
    }));
    /**
     * GET /repositories/:repo/pulls/:number/timeline
     * Get timeline events for a pull request
     */
    router.get('/repositories/:repo/pulls/:number/timeline', asyncHandler(async (req, res) => {
        const { repo, number } = req.params;
        logger.info(`GET /repositories/${repo}/pulls/${number}/timeline`);
        const events = await githubService.getPullRequestTimeline(repo, parseInt(number, 10));
        res.json({ events });
    }));
    logger.info('GitOps backend plugin initialized with all endpoints');
    return router;
}
//# sourceMappingURL=router.js.map