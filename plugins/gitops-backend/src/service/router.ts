import { LoggerService, RootConfigService } from '@backstage/backend-plugin-api';
import { DatabaseService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import crypto from 'crypto';
import { Knex } from 'knex';
import { GitHubService } from '../services/GitHubService';
import { GitHubActionsService } from '../services/GitHubActionsService';
import { ArgoCDService } from '../services/ArgoCDService';
import { AuditService } from '../services/AuditService';
import { BulkOperationService } from '../services/BulkOperationService';
import { GrafanaService } from '../services/GrafanaService';
import { HealthService } from '../services/HealthService';
import { GitLabService } from '../services/GitLabService';
import { UptimeKumaService } from '../services/UptimeKumaService';
import { AuthTokenService } from '../services/AuthTokenService';
import { PermissionService, Permission, Role, requirePermission, requireRole } from '../services/PermissionService';
import { MaturityService } from '../services/MaturityService';
import { CostService } from '../services/CostService';
import {
  listRepositoriesSchema,
  listBranchesSchema,
  getFileTreeSchema,
  getFileContentSchema,
  updateFileSchema,
  listArgoCDAppsSchema,
  syncArgoCDAppSchema,
  getBulkOperationSchema,
  listBulkOperationsSchema,
  listAuditLogsSchema,
  validate,
} from '../validation/schemas';
import { asyncHandler } from '../errors';
import { requestLoggerMiddleware, getUserContext } from '../middleware/requestLogger';
import { generalRateLimiter, bulkOperationsRateLimiter, syncRateLimiter } from '../middleware/rateLimiter';
import { securityHeadersMiddleware } from '../middleware/securityHeaders';
import type {
  ListRepositoriesRequest,
  ListBranchesRequest,
  GetFileTreeRequest,
  GetFileContentRequest,
  UpdateFileRequest,
  ListArgoCDAppsRequest,
  SyncArgoCDAppRequest,
  GetBulkOperationRequest,
} from '../types';

export interface RouterOptions {
  logger: LoggerService;
  config: RootConfigService;
  database: DatabaseService;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
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

  // Default GitHubService with static token (fallback when no OAuth token)
  const defaultGitHubService = new GitHubService({
    token: githubToken,
    organization: githubOrg,
  });

  /**
   * Get GitHubService for a request
   * Uses the user's OAuth token from x-github-token header if available,
   * otherwise falls back to the static config token.
   */
  const getGitHubServiceForRequest = (req: express.Request): GitHubService => {
    const oauthToken = req.headers['x-github-token'] as string | undefined;

    if (oauthToken) {
      logger.debug('Using user OAuth token for GitHub API call');
      return new GitHubService({
        token: oauthToken,
        organization: githubOrg,
      });
    }

    logger.debug('Using fallback static GitHub token');
    return defaultGitHubService;
  };

  // For backwards compatibility, keep the old reference
  const githubService = defaultGitHubService;

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

  let grafanaService: GrafanaService | null = null;
  if (grafanaEnabled && grafanaUrl && grafanaToken) {
    grafanaService = new GrafanaService({
      url: grafanaUrl,
      token: grafanaToken,
    });
    logger.info(`Grafana integration enabled: ${grafanaUrl}`);
  } else {
    logger.info('Grafana integration disabled or not configured');
  }

  // Initialize GitLab service
  const gitlabEnabled = config.getOptionalBoolean('gitops.gitlab.enabled') || false;
  const gitlabUrl = config.getOptionalString('gitops.gitlab.baseUrl') || 'https://gitlab.com';
  const gitlabToken = config.getOptionalString('gitops.gitlab.token') || '';

  let gitlabService: GitLabService | null = null;
  if (gitlabEnabled && gitlabToken) {
    gitlabService = new GitLabService({
      baseUrl: gitlabUrl,
      token: gitlabToken,
    });
    logger.info(`GitLab integration enabled: ${gitlabUrl}`);
  } else {
    logger.info('GitLab integration disabled or not configured');
  }

  // Initialize Uptime Kuma service
  const uptimeKumaEnabled = config.getOptionalBoolean('gitops.uptimeKuma.enabled') || false;
  const uptimeKumaUrl = config.getOptionalString('gitops.uptimeKuma.baseUrl') || '';
  const uptimeKumaApiKey = config.getOptionalString('gitops.uptimeKuma.apiKey') || '';

  let uptimeKumaService: UptimeKumaService | null = null;
  if (uptimeKumaEnabled && uptimeKumaUrl) {
    uptimeKumaService = new UptimeKumaService({
      baseUrl: uptimeKumaUrl,
      apiKey: uptimeKumaApiKey,
    });
    logger.info(`Uptime Kuma integration enabled: ${uptimeKumaUrl}`);
  } else {
    logger.info('Uptime Kuma integration disabled or not configured');
  }

  // Initialize Auth Token service for OAuth-based access
  const allowUnauthenticated = config.getOptionalBoolean('gitops.auth.allowUnauthenticated') ?? true;
  const authTokenService = new AuthTokenService({
    fallbackGitHubToken: githubToken,
    fallbackGitLabToken: gitlabToken,
    allowUnauthenticated,
  });

  // Initialize GitHub Actions service
  const githubActionsService = new GitHubActionsService(config as any, logger as any);
  logger.info('GitHub Actions integration initialized');

  // Initialize Permission service
  const superAdmins = config.getOptionalStringArray('gitops.permissions.superAdmins') || [];
  const defaultRole = config.getOptionalString('gitops.permissions.defaultRole') as Role || Role.DEVELOPER;
  
  const permissionService = new PermissionService({
    superAdmins,
    defaultRole,
    allowGuest: allowUnauthenticated,
    // Map GitHub teams to roles
    groupRoleMapping: {
      'admins': [Role.ADMIN],
      'sre-team': [Role.OPERATOR],
      'developers': [Role.DEVELOPER],
      'readonly': [Role.VIEWER],
    },
  });
  logger.info('Permission service initialized');

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
    } else {
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
   * Uses user's OAuth token if available for user-scoped access
   */
  router.get(
    '/repositories',
    asyncHandler(async (req, res) => {
      logger.info('GET /repositories');

      // Validate request
      const params = validate<ListRepositoriesRequest>(
        listRepositoriesSchema,
        req.query
      );

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      // Fetch repositories
      const repositories = await service.listRepositories(params.filter);

      res.json({
        repositories,
        total: repositories.length,
      });
    })
  );

  /**
   * GET /repositories/:repo/branches
   * List all branches for a repository
   * Uses user's OAuth token if available for user-scoped access
   */
  router.get(
    '/repositories/:repo/branches',
    asyncHandler(async (req, res) => {
      const { repo } = req.params;
      logger.info(`GET /repositories/${repo}/branches`);

      // Validate request
      const params = validate<ListBranchesRequest>(listBranchesSchema, {
        repository: repo,
        ...req.query,
      });

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      // Fetch branches
      const branches = await service.listBranches(
        params.repository,
        params.filter
      );

      res.json({
        branches,
        total: branches.length,
      });
    })
  );

  /**
   * GET /repositories/:repo/tree
   * Get file tree for a repository branch
   * Uses user's OAuth token if available for user-scoped access
   */
  router.get(
    '/repositories/:repo/tree',
    asyncHandler(async (req, res) => {
      const { repo } = req.params;
      const { branch, path } = req.query;
      logger.info(`GET /repositories/${repo}/tree - branch: ${branch}, path: ${path}`);

      // Validate request
      const params = validate<GetFileTreeRequest>(getFileTreeSchema, {
        repository: repo,
        branch: branch as string,
        path: path as string,
      });

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      // Fetch file tree
      const entries = await service.getFileTree(
        params.repository,
        params.branch,
        params.path || ''
      );

      res.json({
        entries,
        path: params.path || '',
      });
    })
  );

  /**
   * GET /repositories/:repo/content
   * Get file content from a repository branch
   * Uses user's OAuth token if available for user-scoped access
   */
  router.get(
    '/repositories/:repo/content',
    asyncHandler(async (req, res) => {
      const { repo } = req.params;
      const { branch, path } = req.query;
      logger.info(`GET /repositories/${repo}/content - branch: ${branch}, path: ${path}`);

      // Validate request
      const params = validate<GetFileContentRequest>(getFileContentSchema, {
        repository: repo,
        branch: branch as string,
        path: path as string,
      });

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      // Fetch file content
      const fileContent = await service.getFileContent(
        params.repository,
        params.branch,
        params.path
      );

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
    })
  );

  // ===========================================================================
  // File Update Operations
  // ===========================================================================

  /**
   * POST /repositories/:repo/files/update
   * Update file across multiple branches (BULK OPERATION)
   */
  router.post(
    '/repositories/:repo/files/update',
    bulkOperationsRateLimiter, // Apply stricter rate limit for bulk ops
    asyncHandler(async (req, res) => {
      const { repo } = req.params;
      logger.info(`POST /repositories/${repo}/files/update`);

      // Validate request
      const params = validate<UpdateFileRequest>(updateFileSchema, {
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
    })
  );

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  /**
   * GET /bulk-operations/:operation_id
   * Get bulk operation status
   */
  router.get(
    '/bulk-operations/:operation_id',
    asyncHandler(async (req, res) => {
      const { operation_id } = req.params;
      logger.info(`GET /bulk-operations/${operation_id}`);

      // Validate request
      const params = validate<GetBulkOperationRequest>(getBulkOperationSchema, {
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
    })
  );

  /**
   * GET /bulk-operations
   * List bulk operations with filters
   */
  router.get(
    '/bulk-operations',
    asyncHandler(async (req, res) => {
      logger.info('GET /bulk-operations');

      // Validate request
      const params = validate(listBulkOperationsSchema, req.query) as {
        user_id?: string;
        status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
        operation_type?: 'bulk_update' | 'bulk_commit' | 'bulk_sync';
        limit?: number;
        offset?: number;
      };

      // Get operations
      const { operations, total } = await bulkOperationService.listOperations(params);

      res.json({
        operations,
        total,
        limit: params.limit || 20,
        offset: params.offset || 0,
      });
    })
  );

  // ===========================================================================
  // Audit Logs
  // ===========================================================================

  /**
   * GET /audit-logs
   * List audit logs with filters
   */
  router.get(
    '/audit-logs',
    asyncHandler(async (req, res) => {
      logger.info('GET /audit-logs');

      // Validate request
      const params = validate(listAuditLogsSchema, req.query) as {
        limit?: number;
        offset?: number;
        start_date?: string;
        end_date?: string;
        user_id?: string;
        operation?: 'read' | 'update' | 'commit' | 'sync' | 'delete';
        resource_type?: 'repository' | 'branch' | 'file' | 'argocd_app';
        repository?: string;
        branch?: string;
        status?: 'pending' | 'success' | 'failure';
      };

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
    })
  );

  // ===========================================================================
  // ArgoCD Operations
  // ===========================================================================

  /**
   * GET /argocd/applications
   * List ArgoCD applications
   */
  router.get(
    '/argocd/applications',
    asyncHandler(async (req, res) => {
      logger.info('GET /argocd/applications');

      // Validate request
      const params = validate<ListArgoCDAppsRequest>(listArgoCDAppsSchema, req.query);

      // Get applications
      let applications = await argoCDService.listApplications(params.filter);

      // Filter by branch if specified
      if (params.branch) {
        applications = applications.filter(app =>
          app.spec.source.targetRevision === params.branch
        );
      }

      res.json({
        applications,
        total: applications.length,
      });
    })
  );

  /**
   * GET /argocd/applications/:appName
   * Get specific ArgoCD application
   */
  router.get(
    '/argocd/applications/:appName',
    asyncHandler(async (req, res) => {
      const { appName } = req.params;
      logger.info(`GET /argocd/applications/${appName}`);

      // Get application
      const application = await argoCDService.getApplication(appName);

      res.json({ application });
    })
  );

  /**
   * POST /argocd/sync
   * Sync ArgoCD applications
   */
  router.post(
    '/argocd/sync',
    syncRateLimiter, // Apply sync-specific rate limit
    asyncHandler(async (req, res) => {
      logger.info('POST /argocd/sync');

      // Validate request
      const params = validate<SyncArgoCDAppRequest>(syncArgoCDAppSchema, req.body);

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
    })
  );

  // ===========================================================================
  // Grafana Operations
  // ===========================================================================

  /**
   * GET /grafana/dashboards
   * List all Grafana dashboards
   */
  router.get(
    '/grafana/dashboards',
    asyncHandler(async (req, res) => {
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
    })
  );

  /**
   * GET /grafana/dashboards/:uid
   * Get specific Grafana dashboard
   */
  router.get(
    '/grafana/dashboards/:uid',
    asyncHandler(async (req, res) => {
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
    })
  );

  /**
   * GET /grafana/folders
   * List all Grafana folders
   */
  router.get(
    '/grafana/folders',
    asyncHandler(async (req, res) => {
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
    })
  );

  /**
   * GET /grafana/search
   * Search Grafana dashboards
   */
  router.get(
    '/grafana/search',
    asyncHandler(async (req, res) => {
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

      const dashboards = await grafanaService.searchDashboards(query as string || '');

      res.json({
        dashboards,
        total: dashboards.length,
      });
    })
  );

  // ===========================================================================
  // GitLab Operations
  // ===========================================================================

  /**
   * GET /gitlab/projects
   * List GitLab projects
   */
  router.get(
    '/gitlab/projects',
    asyncHandler(async (req, res) => {
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
        search: search as string,
        page: page ? parseInt(page as string, 10) : undefined,
        perPage: per_page ? parseInt(per_page as string, 10) : undefined,
      });

      res.json({
        projects,
        total: projects.length,
      });
    })
  );

  /**
   * GET /gitlab/projects/:projectId
   * Get GitLab project details
   */
  router.get(
    '/gitlab/projects/:projectId',
    asyncHandler(async (req, res) => {
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
    })
  );

  /**
   * GET /gitlab/projects/:projectId/branches
   * List GitLab project branches
   */
  router.get(
    '/gitlab/projects/:projectId/branches',
    asyncHandler(async (req, res) => {
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
    })
  );

  /**
   * GET /gitlab/projects/:projectId/tree
   * Get GitLab project file tree
   */
  router.get(
    '/gitlab/projects/:projectId/tree',
    asyncHandler(async (req, res) => {
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
        ref: ref as string,
        path: path as string,
        recursive: recursive === 'true',
      });
      res.json({ tree, total: tree.length });
    })
  );

  /**
   * GET /gitlab/projects/:projectId/files
   * Get GitLab file content
   */
  router.get(
    '/gitlab/projects/:projectId/files',
    asyncHandler(async (req, res) => {
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

      const file = await gitlabService.getFile(projectId, path as string, ref as string);
      const content = Buffer.from(file.content, 'base64').toString('utf-8');
      res.json({ ...file, decodedContent: content });
    })
  );

  /**
   * PUT /gitlab/projects/:projectId/files
   * Update GitLab file
   */
  router.put(
    '/gitlab/projects/:projectId/files',
    asyncHandler(async (req, res) => {
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
    })
  );

  /**
   * GET /gitlab/projects/:projectId/merge_requests
   * List GitLab merge requests
   */
  router.get(
    '/gitlab/projects/:projectId/merge_requests',
    asyncHandler(async (req, res) => {
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
        state: state as any,
      });
      res.json({ mergeRequests, total: mergeRequests.length });
    })
  );

  /**
   * POST /gitlab/projects/:projectId/merge_requests
   * Create GitLab merge request
   */
  router.post(
    '/gitlab/projects/:projectId/merge_requests',
    asyncHandler(async (req, res) => {
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
    })
  );

  /**
   * GET /gitlab/projects/:projectId/pipelines
   * List GitLab pipelines
   */
  router.get(
    '/gitlab/projects/:projectId/pipelines',
    asyncHandler(async (req, res) => {
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
        ref: ref as string,
        status: status as string,
      });
      res.json({ pipelines, total: pipelines.length });
    })
  );

  /**
   * GET /gitlab/health
   * Check GitLab service health
   */
  router.get(
    '/gitlab/health',
    asyncHandler(async (_, res) => {
      if (!gitlabService) {
        res.json({ healthy: false, message: 'GitLab integration not configured' });
        return;
      }

      const health = await gitlabService.healthCheck();
      res.json(health);
    })
  );

  // ===========================================================================
  // Uptime Kuma Operations
  // ===========================================================================

  /**
   * GET /uptime-kuma/monitors
   * List all Uptime Kuma monitors
   */
  router.get(
    '/uptime-kuma/monitors',
    asyncHandler(async (req, res) => {
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
    })
  );

  /**
   * GET /uptime-kuma/monitors/:id
   * Get Uptime Kuma monitor details with status
   */
  router.get(
    '/uptime-kuma/monitors/:id',
    asyncHandler(async (req, res) => {
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
    })
  );

  /**
   * GET /uptime-kuma/stats
   * Get Uptime Kuma overall statistics
   */
  router.get(
    '/uptime-kuma/stats',
    asyncHandler(async (_, res) => {
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
    })
  );

  /**
   * GET /uptime-kuma/dashboard
   * Get Uptime Kuma dashboard summary
   */
  router.get(
    '/uptime-kuma/dashboard',
    asyncHandler(async (_, res) => {
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
    })
  );

  /**
   * GET /uptime-kuma/status-pages
   * List Uptime Kuma status pages
   */
  router.get(
    '/uptime-kuma/status-pages',
    asyncHandler(async (_, res) => {
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
    })
  );

  /**
   * GET /uptime-kuma/health
   * Check Uptime Kuma service health
   */
  router.get(
    '/uptime-kuma/health',
    asyncHandler(async (_, res) => {
      if (!uptimeKumaService) {
        res.json({ healthy: false, message: 'Uptime Kuma integration not configured' });
        return;
      }

      const health = await uptimeKumaService.healthCheck();
      res.json(health);
    })
  );

  /**
   * POST /uptime-kuma/monitors/:id/pause
   * Pause a monitor
   */
  router.post(
    '/uptime-kuma/monitors/:id/pause',
    asyncHandler(async (req, res) => {
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
    })
  );

  /**
   * POST /uptime-kuma/monitors/:id/resume
   * Resume a monitor
   */
  router.post(
    '/uptime-kuma/monitors/:id/resume',
    asyncHandler(async (req, res) => {
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
    })
  );

  // ===========================================================================
  // GitHub Actions Operations
  // ===========================================================================

  /**
   * GET /repositories/:repo/actions/workflows
   * List all workflows for a repository
   */
  router.get(
    '/repositories/:repo/actions/workflows',
    asyncHandler(async (req, res) => {
      const { repo } = req.params;
      logger.info(`GET /repositories/${repo}/actions/workflows`);

      const workflows = await githubActionsService.listWorkflows(repo);
      res.json({ workflows, total: workflows.length });
    })
  );

  /**
   * GET /repositories/:repo/actions/runs
   * Get workflow runs for a repository
   */
  router.get(
    '/repositories/:repo/actions/runs',
    asyncHandler(async (req, res) => {
      const { repo } = req.params;
      const { workflow_id, branch, status, per_page, page } = req.query;
      logger.info(`GET /repositories/${repo}/actions/runs`);

      const { runs, total_count } = await githubActionsService.getWorkflowRuns(repo, {
        workflow_id: workflow_id ? parseInt(workflow_id as string, 10) : undefined,
        branch: branch as string,
        status: status as string,
        per_page: per_page ? parseInt(per_page as string, 10) : 10,
        page: page ? parseInt(page as string, 10) : 1,
      });

      res.json({ runs, total: total_count });
    })
  );

  /**
   * GET /repositories/:repo/actions/runs/:runId
   * Get a specific workflow run
   */
  router.get(
    '/repositories/:repo/actions/runs/:runId',
    asyncHandler(async (req, res) => {
      const { repo, runId } = req.params;
      logger.info(`GET /repositories/${repo}/actions/runs/${runId}`);

      const run = await githubActionsService.getWorkflowRun(repo, parseInt(runId, 10));
      res.json({ run });
    })
  );

  /**
   * GET /repositories/:repo/actions/runs/:runId/jobs
   * Get jobs for a workflow run
   */
  router.get(
    '/repositories/:repo/actions/runs/:runId/jobs',
    asyncHandler(async (req, res) => {
      const { repo, runId } = req.params;
      logger.info(`GET /repositories/${repo}/actions/runs/${runId}/jobs`);

      const jobs = await githubActionsService.getWorkflowRunJobs(repo, parseInt(runId, 10));
      res.json({ jobs, total: jobs.length });
    })
  );

  /**
   * GET /repositories/:repo/actions/summary
   * Get build status summary for a repository
   */
  router.get(
    '/repositories/:repo/actions/summary',
    asyncHandler(async (req, res) => {
      const { repo } = req.params;
      const { branch } = req.query;
      logger.info(`GET /repositories/${repo}/actions/summary`);

      const summary = await githubActionsService.getBuildStatusSummary(repo, branch as string);
      res.json(summary);
    })
  );

  /**
   * POST /repositories/:repo/actions/runs/:runId/rerun
   * Re-run a workflow
   */
  router.post(
    '/repositories/:repo/actions/runs/:runId/rerun',
    asyncHandler(async (req, res) => {
      const { repo, runId } = req.params;
      logger.info(`POST /repositories/${repo}/actions/runs/${runId}/rerun`);

      await githubActionsService.rerunWorkflow(repo, parseInt(runId, 10));

      // Audit log
      const userContext = getUserContext(req);
      await auditService.log({
        user_id: userContext.userId,
        user_email: userContext.userEmail,
        operation: 'update',
        resource_type: 'repository',
        resource_id: `${repo}/actions/runs/${runId}`,
        repository: repo,
        metadata: { action: 'rerun_workflow', run_id: runId },
        status: 'success',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      res.json({ success: true, message: `Workflow run ${runId} restarted` });
    })
  );

  /**
   * POST /repositories/:repo/actions/runs/:runId/rerun-failed
   * Re-run failed jobs in a workflow
   */
  router.post(
    '/repositories/:repo/actions/runs/:runId/rerun-failed',
    asyncHandler(async (req, res) => {
      const { repo, runId } = req.params;
      logger.info(`POST /repositories/${repo}/actions/runs/${runId}/rerun-failed`);

      await githubActionsService.rerunFailedJobs(repo, parseInt(runId, 10));
      res.json({ success: true, message: `Failed jobs in run ${runId} restarted` });
    })
  );

  /**
   * POST /repositories/:repo/actions/runs/:runId/cancel
   * Cancel a workflow run
   */
  router.post(
    '/repositories/:repo/actions/runs/:runId/cancel',
    asyncHandler(async (req, res) => {
      const { repo, runId } = req.params;
      logger.info(`POST /repositories/${repo}/actions/runs/${runId}/cancel`);

      await githubActionsService.cancelWorkflowRun(repo, parseInt(runId, 10));
      res.json({ success: true, message: `Workflow run ${runId} cancelled` });
    })
  );

  /**
   * POST /repositories/:repo/actions/workflows/:workflowId/dispatches
   * Trigger a workflow dispatch event
   */
  router.post(
    '/repositories/:repo/actions/workflows/:workflowId/dispatches',
    asyncHandler(async (req, res) => {
      const { repo, workflowId } = req.params;
      const { ref, inputs } = req.body;
      logger.info(`POST /repositories/${repo}/actions/workflows/${workflowId}/dispatches`);

      if (!ref) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'ref is required' },
        });
        return;
      }

      await githubActionsService.triggerWorkflow(repo, workflowId, ref, inputs);

      // Audit log
      const userContext = getUserContext(req);
      await auditService.log({
        user_id: userContext.userId,
        user_email: userContext.userEmail,
        operation: 'update',
        resource_type: 'repository',
        resource_id: `${repo}/actions/workflows/${workflowId}`,
        repository: repo,
        branch: ref,
        metadata: { action: 'trigger_workflow', workflow_id: workflowId, inputs },
        status: 'success',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      res.status(202).json({ success: true, message: `Workflow ${workflowId} triggered on ${ref}` });
    })
  );

  // ===========================================================================
  // Auth Token Operations (for OAuth-based access)
  // ===========================================================================

  /**
   * GET /auth/user
   * Get current authenticated user info
   */
  router.get(
    '/auth/user',
    asyncHandler(async (req, res) => {
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
    })
  );

  /**
   * GET /auth/organizations
   * Get organizations the user has access to
   */
  router.get(
    '/auth/organizations',
    asyncHandler(async (req, res) => {
      const orgs = await authTokenService.getUserOrganizations(req);
      res.json({ organizations: orgs });
    })
  );

  // ===========================================================================
  // Permission Operations (RBAC)
  // ===========================================================================

  /**
   * GET /permissions
   * Get current user's permissions and roles
   */
  router.get(
    '/permissions',
    asyncHandler(async (req, res) => {
      const context = permissionService.getUserPermissions(req);
      res.json({
        userId: context.userId,
        email: context.email,
        displayName: context.displayName,
        roles: context.roles,
        permissions: context.permissions,
        groups: context.groups,
      });
    })
  );

  /**
   * POST /permissions/check
   * Check if user has specific permissions
   */
  router.post(
    '/permissions/check',
    asyncHandler(async (req, res) => {
      const { permissions } = req.body;
      
      if (!permissions || !Array.isArray(permissions)) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'permissions array is required' },
        });
        return;
      }

      const context = permissionService.getUserPermissions(req);
      const results: Record<string, boolean> = {};

      for (const permission of permissions) {
        results[permission] = permissionService.hasPermission(context, permission as Permission);
      }

      res.json({
        userId: context.userId,
        roles: context.roles,
        results,
      });
    })
  );

  /**
   * GET /permissions/roles
   * Get all available roles and their permissions
   */
  router.get(
    '/permissions/roles',
    asyncHandler(async (req, res) => {
      const roles = permissionService.getAvailableRoles();
      const roleDetails = roles.map(role => ({
        role,
        permissions: permissionService.getPermissionsForRole(role),
      }));

      res.json({ roles: roleDetails });
    })
  );

  /**
   * GET /permissions/all
   * Get all available permissions (for admin UI)
   */
  router.get(
    '/permissions/all',
    requireRole(permissionService, Role.ADMIN),
    asyncHandler(async (req, res) => {
      res.json({
        permissions: permissionService.getAllPermissions(),
        roles: permissionService.getAvailableRoles(),
      });
    })
  );

  // ===========================================================================
  // Pull Request Operations
  // ===========================================================================

  /**
   * GET /repositories/:repo/compare/:base...:head
   * Compare two branches and get diff
   * Uses user's OAuth token if available for user-scoped access
   */
  router.get(
    '/repositories/:repo/compare/:base...:head',
    asyncHandler(async (req, res) => {
      const { repo, base, head } = req.params;
      logger.info(`GET /repositories/${repo}/compare/${base}...${head}`);

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      const comparison = await service.compareBranches(repo, base, head);

      res.json({ comparison });
    })
  );

  /**
   * POST /repositories/:repo/branches
   * Create a new branch from an existing branch
   * Uses user's OAuth token if available for user-scoped access
   */
  router.post(
    '/repositories/:repo/branches',
    asyncHandler(async (req, res) => {
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

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      const result = await service.createBranch(repo, branch, from_branch);

      res.status(201).json({ branch: result });
    })
  );

  /**
   * GET /repositories/:repo/pulls
   * List pull requests
   * Uses user's OAuth token if available for user-scoped access
   */
  router.get(
    '/repositories/:repo/pulls',
    asyncHandler(async (req, res) => {
      const { repo } = req.params;
      const { state, sort, direction } = req.query;
      logger.info(`GET /repositories/${repo}/pulls?state=${state}`);

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      const pulls = await service.listPullRequests(
        repo,
        (state as any) || 'open',
        (sort as any) || 'created',
        (direction as any) || 'desc'
      );

      res.json({
        pulls,
        total: pulls.length,
      });
    })
  );

  /**
   * POST /repositories/:repo/pulls
   * Create a pull request
   * Uses user's OAuth token if available for user-scoped access
   */
  router.post(
    '/repositories/:repo/pulls',
    asyncHandler(async (req, res) => {
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

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      const pull = await service.createPullRequest(repo, title, head, base, body);

      res.status(201).json({ pull });
    })
  );

  /**
   * POST /repositories/:repo/pulls/with-changes
   * Create a pull request with file changes (synchronous workflow)
   * This endpoint creates a new branch, commits changes, and creates a PR in one operation
   * Uses user's OAuth token if available for user-scoped access
   */
  router.post(
    '/repositories/:repo/pulls/with-changes',
    asyncHandler(async (req, res) => {
      const { repo } = req.params;
      const {
        title,
        body,
        head,
        base,
        newBranchName,
        baseBranch,
        filePath,
        content,
        fieldPath,
        fieldValue,
        commitMessage,
      } = req.body;

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

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      // Step 1: Create new branch
      await service.createBranch(repo, newBranchName, baseBranch);

      // Step 2: Get the file to obtain its SHA
      const fileContent = await service.getFileContent(repo, newBranchName, filePath);

      // Step 3: Prepare content for commit
      let contentToCommit: string;

      if (fieldPath && fieldValue) {
        // Field-level update: parse YAML, update field, serialize
        const { updateYamlField } = await import('../utils/yamlUtils');
        const currentContent = Buffer.from(fileContent.content, 'base64').toString('utf-8');
        contentToCommit = updateYamlField(currentContent, fieldPath, fieldValue);
      } else if (content) {
        // Full content update
        contentToCommit = content;
      } else {
        throw new Error('Either content or fieldPath/fieldValue must be provided');
      }

      // Step 4: Commit changes synchronously
      await service.updateFile({
        repository: repo,
        branch: newBranchName,
        path: filePath,
        content: Buffer.from(contentToCommit).toString('base64'),
        message: commitMessage,
        sha: fileContent.sha,
      });

      // Step 5: Create pull request
      const pull = await service.createPullRequest(repo, title, newBranchName, base, body);

      res.status(201).json({ pull });
    })
  );

  /**
   * GET /repositories/:repo/pulls/:number
   * Get pull request details
   * Uses user's OAuth token if available for user-scoped access
   */
  router.get(
    '/repositories/:repo/pulls/:number',
    asyncHandler(async (req, res) => {
      const { repo, number } = req.params;
      logger.info(`GET /repositories/${repo}/pulls/${number}`);

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      const pull = await service.getPullRequest(repo, parseInt(number, 10));

      res.json({ pull });
    })
  );

  /**
   * GET /repositories/:repo/pulls/:number/files
   * Get files changed in a pull request (with diff)
   * Uses user's OAuth token if available for user-scoped access
   */
  router.get(
    '/repositories/:repo/pulls/:number/files',
    asyncHandler(async (req, res) => {
      const { repo, number } = req.params;
      logger.info(`GET /repositories/${repo}/pulls/${number}/files`);

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      const files = await service.getPullRequestFiles(repo, parseInt(number, 10));

      res.json({
        files,
        total: files.length,
      });
    })
  );

  /**
   * POST /repositories/:repo/pulls/:number/merge
   * Merge a pull request
   * Uses user's OAuth token if available for user-scoped access
   */
  router.post(
    '/repositories/:repo/pulls/:number/merge',
    asyncHandler(async (req, res) => {
      const { repo, number } = req.params;
      const { commit_title, commit_message, merge_method } = req.body;
      logger.info(`POST /repositories/${repo}/pulls/${number}/merge`);

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      const result = await service.mergePullRequest(
        repo,
        parseInt(number, 10),
        commit_title,
        commit_message,
        merge_method || 'merge'
      );

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
    })
  );

  /**
   * POST /repositories/:repo/pulls/:number/reviewers
   * Add reviewers to a pull request
   * Uses user's OAuth token if available for user-scoped access
   */
  router.post(
    '/repositories/:repo/pulls/:number/reviewers',
    asyncHandler(async (req, res) => {
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

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      const result = await service.addReviewers(
        repo,
        parseInt(number, 10),
        reviewers,
        team_reviewers
      );

      res.json({ result });
    })
  );

  /**
   * POST /repositories/:repo/pulls/:number/assignees
   * Assign pull request to users
   * Uses user's OAuth token if available for user-scoped access
   */
  router.post(
    '/repositories/:repo/pulls/:number/assignees',
    asyncHandler(async (req, res) => {
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

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      const result = await service.assignPullRequest(
        repo,
        parseInt(number, 10),
        assignees
      );

      res.json({ result });
    })
  );

  /**
   * GET /repositories/:repo/pulls/:number/comments
   * Get comments for a pull request
   * Uses user's OAuth token if available for user-scoped access
   */
  router.get(
    '/repositories/:repo/pulls/:number/comments',
    asyncHandler(async (req, res) => {
      const { repo, number } = req.params;
      logger.info(`GET /repositories/${repo}/pulls/${number}/comments`);

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      const comments = await service.getPullRequestComments(
        repo,
        parseInt(number, 10)
      );

      res.json({ comments });
    })
  );

  /**
   * POST /repositories/:repo/pulls/:number/comments
   * Add a comment to a pull request
   * Uses user's OAuth token if available for user-scoped access
   */
  router.post(
    '/repositories/:repo/pulls/:number/comments',
    asyncHandler(async (req, res) => {
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

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      const comment = await service.addPullRequestComment(
        repo,
        parseInt(number, 10),
        body
      );

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
    })
  );

  /**
   * GET /repositories/:repo/pulls/:number/status-checks
   * Get status checks for a pull request
   * Uses user's OAuth token if available for user-scoped access
   */
  router.get(
    '/repositories/:repo/pulls/:number/status-checks',
    asyncHandler(async (req, res) => {
      const { repo, number } = req.params;
      logger.info(`GET /repositories/${repo}/pulls/${number}/status-checks`);

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      const checks = await service.getPullRequestStatusChecks(
        repo,
        parseInt(number, 10)
      );

      res.json({ checks });
    })
  );

  /**
   * GET /repositories/:repo/pulls/:number/reviews
   * Get reviews for a pull request
   * Uses user's OAuth token if available for user-scoped access
   */
  router.get(
    '/repositories/:repo/pulls/:number/reviews',
    asyncHandler(async (req, res) => {
      const { repo, number } = req.params;
      logger.info(`GET /repositories/${repo}/pulls/${number}/reviews`);

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      const reviews = await service.getPullRequestReviews(
        repo,
        parseInt(number, 10)
      );

      res.json({ reviews });
    })
  );

  /**
   * GET /repositories/:repo/pulls/:number/timeline
   * Get timeline events for a pull request
   * Uses user's OAuth token if available for user-scoped access
   */
  router.get(
    '/repositories/:repo/pulls/:number/timeline',
    asyncHandler(async (req, res) => {
      const { repo, number } = req.params;
      logger.info(`GET /repositories/${repo}/pulls/${number}/timeline`);

      // Get GitHubService with user's OAuth token if available
      const service = getGitHubServiceForRequest(req);

      const events = await service.getPullRequestTimeline(
        repo,
        parseInt(number, 10)
      );

      res.json({ events });
    })
  );

  // ==========================================
  // Maturity Scorecard Endpoints
  // ==========================================
  
  const maturityService = new MaturityService(config);

  /**
   * GET /maturity/:owner/:repo
   * Get maturity scorecard for a repository
   */
  router.get(
    '/maturity/:owner/:repo',
    asyncHandler(async (req, res) => {
      const { owner, repo } = req.params;
      logger.info(`GET /maturity/${owner}/${repo}`);

      const result = await maturityService.evaluateMaturity(owner, repo);
      res.json(result);
    })
  );

  /**
   * GET /maturity/:owner/:repo/badge
   * Get maturity badge SVG for a repository
   */
  router.get(
    '/maturity/:owner/:repo/badge',
    asyncHandler(async (req, res) => {
      const { owner, repo } = req.params;
      logger.info(`GET /maturity/${owner}/${repo}/badge`);

      const result = await maturityService.evaluateMaturity(owner, repo);
      const svg = maturityService.getBadgeSVG(result.grade, result.percentage);
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(svg);
    })
  );

  // ==========================================
  // Cost Insights Endpoints
  // ==========================================
  
  const costService = new CostService(config);

  /**
   * GET /cost/summary
   * Get cost summary for a time period
   */
  router.get(
    '/cost/summary',
    asyncHandler(async (req, res) => {
      const { period = 'monthly', service } = req.query;
      logger.info(`GET /cost/summary?period=${period}&service=${service || 'all'}`);

      const summary = await costService.getCostSummary(
        period as 'daily' | 'weekly' | 'monthly',
        service as string | undefined
      );
      res.json(summary);
    })
  );

  /**
   * GET /cost/recommendations
   * Get cost optimization recommendations
   */
  router.get(
    '/cost/recommendations',
    asyncHandler(async (req, res) => {
      logger.info('GET /cost/recommendations');
      const recommendations = await costService.getRecommendations();
      res.json({ recommendations });
    })
  );

  /**
   * GET /cost/anomalies
   * Get cost anomalies
   */
  router.get(
    '/cost/anomalies',
    asyncHandler(async (req, res) => {
      logger.info('GET /cost/anomalies');
      const anomalies = await costService.getAnomalies();
      res.json({ anomalies });
    })
  );

  /**
   * GET /cost/forecast
   * Get cost forecast
   */
  router.get(
    '/cost/forecast',
    asyncHandler(async (req, res) => {
      const { months = '3' } = req.query;
      logger.info(`GET /cost/forecast?months=${months}`);
      const forecast = await costService.getForecast(parseInt(months as string, 10));
      res.json(forecast);
    })
  );

  // ==========================================
  // AI Search Endpoints
  // ==========================================

  const { AISearchService } = await import('../services/AISearchService');
  const aiSearchService = new AISearchService(config as any, logger as any);
  logger.info(`AI Search Service initialized (enabled: ${aiSearchService.isEnabled()})`);

  /**
   * GET /search
   * AI-powered search across documentation, code, and configs
   */
  router.get(
    '/search',
    asyncHandler(async (req, res) => {
      const { q, maxResults = '10', sources } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      logger.info(`GET /search?q=${q}`);

      const sourcesArray = sources
        ? (sources as string).split(',') as ('documentation' | 'code' | 'config' | 'runbook' | 'api')[]
        : undefined;

      const results = await aiSearchService.search(q, {
        maxResults: parseInt(maxResults as string, 10),
        sources: sourcesArray,
      });

      res.json(results);
    })
  );

  /**
   * POST /search/ask
   * Ask a question using RAG (Retrieval Augmented Generation)
   */
  router.post(
    '/search/ask',
    asyncHandler(async (req, res) => {
      const { question } = req.body;

      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Question is required' });
      }

      logger.info(`POST /search/ask: ${question.substring(0, 50)}...`);

      const answer = await aiSearchService.answerQuestion(question);
      res.json(answer);
    })
  );

  /**
   * GET /search/status
   * Get AI Search service status
   */
  router.get(
    '/search/status',
    asyncHandler(async (req, res) => {
      const status = aiSearchService.getStatus();
      res.json(status);
    })
  );

  /**
   * POST /search/index
   * Index a document for search
   */
  router.post(
    '/search/index',
    asyncHandler(async (req, res) => {
      const { title, content, source, path, metadata } = req.body;

      if (!title || !content || !source || !path) {
        return res.status(400).json({ error: 'title, content, source, and path are required' });
      }

      logger.info(`POST /search/index: ${path}`);

      await aiSearchService.indexDocument({ title, content, source, path, metadata });
      res.json({ success: true, message: 'Document indexed successfully' });
    })
  );

  /**
   * GET /search/stats
   * Get search index statistics
   */
  router.get(
    '/search/stats',
    asyncHandler(async (req, res) => {
      const stats = aiSearchService.getIndexStats();
      res.json(stats);
    })
  );

  // ==========================================
  // Day-2 Operations Endpoints
  // ==========================================

  const { Day2OperationsService } = await import('../services/Day2OperationsService');
  const day2OpsService = new Day2OperationsService(config as any, logger as any);
  logger.info('Day-2 Operations Service initialized');

  /**
   * GET /operations/definitions
   * Get available operation definitions
   */
  router.get(
    '/operations/definitions',
    asyncHandler(async (req, res) => {
      logger.info('GET /operations/definitions');
      const definitions = day2OpsService.getOperationDefinitions();
      res.json(definitions);
    })
  );

  /**
   * GET /operations/definition/:type
   * Get a specific operation definition
   */
  router.get(
    '/operations/definition/:type',
    asyncHandler(async (req, res) => {
      const { type } = req.params;
      logger.info(`GET /operations/definition/${type}`);

      const definition = day2OpsService.getOperationDefinition(type as any);
      if (!definition) {
        return res.status(404).json({ error: `Operation type ${type} not found` });
      }
      res.json(definition);
    })
  );

  /**
   * POST /operations/execute
   * Execute a Day-2 operation
   */
  router.post(
    '/operations/execute',
    asyncHandler(async (req, res) => {
      const { type, target, parameters, requestedBy, reason } = req.body;

      if (!type || !target || !requestedBy) {
        return res.status(400).json({
          error: 'type, target, and requestedBy are required'
        });
      }

      logger.info(`POST /operations/execute: ${type} for ${target.namespace}/${target.name}`);

      const result = await day2OpsService.executeOperation({
        type,
        target,
        parameters: parameters || {},
        requestedBy,
        reason,
      });

      res.json(result);
    })
  );

  /**
   * POST /operations/:id/approve
   * Approve a pending operation
   */
  router.post(
    '/operations/:id/approve',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { approvedBy } = req.body;

      if (!approvedBy) {
        return res.status(400).json({ error: 'approvedBy is required' });
      }

      logger.info(`POST /operations/${id}/approve by ${approvedBy}`);

      const result = await day2OpsService.approveOperation(id, approvedBy);
      res.json(result);
    })
  );

  /**
   * POST /operations/:id/cancel
   * Cancel a pending operation
   */
  router.post(
    '/operations/:id/cancel',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { cancelledBy } = req.body;

      if (!cancelledBy) {
        return res.status(400).json({ error: 'cancelledBy is required' });
      }

      logger.info(`POST /operations/${id}/cancel by ${cancelledBy}`);

      const result = day2OpsService.cancelOperation(id, cancelledBy);
      res.json(result);
    })
  );

  /**
   * GET /operations/history
   * Get operation history
   */
  router.get(
    '/operations/history',
    asyncHandler(async (req, res) => {
      const { type, status, limit = '20', namespace, name } = req.query;

      logger.info(`GET /operations/history`);

      const history = day2OpsService.getOperationHistory({
        type: type as any,
        status: status as any,
        limit: parseInt(limit as string, 10),
      });

      // Filter by target if provided
      let filteredHistory = history;
      if (namespace || name) {
        filteredHistory = history.filter(op =>
          (!namespace || op.target.namespace === namespace) &&
          (!name || op.target.name === name)
        );
      }

      res.json(filteredHistory);
    })
  );

  /**
   * GET /operations/:id
   * Get a specific operation
   */
  router.get(
    '/operations/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      logger.info(`GET /operations/${id}`);

      const operation = day2OpsService.getOperation(id);
      if (!operation) {
        return res.status(404).json({ error: `Operation ${id} not found` });
      }
      res.json(operation);
    })
  );

  // ==========================================
  // Local Authentication Endpoints
  // ==========================================

  const { LocalAuthService, localAuthMiddleware } = await import('../services/LocalAuthService');
  const localAuthService = new LocalAuthService(knex as any, {
    jwtSecret: config.getOptionalString('localAuth.jwtSecret') || crypto.randomBytes(32).toString('hex'),
    jwtExpiresIn: config.getOptionalNumber('localAuth.jwtExpiresIn') || 86400,
  });
  logger.info('Local Auth Service initialized');

  // Create default admin user if it doesn't exist
  try {
    const existingAdmin = await localAuthService.getUserByUsername?.('admin');
    if (!existingAdmin) {
      await localAuthService.createUser({
        username: 'admin',
        email: 'admin@devops-portal.local',
        password: 'Admin@123!',
        displayName: 'Portal Admin',
        role: 'admin',
      });
      logger.info('Default admin user created (username: admin, password: Admin@123!)');
    } else {
      logger.info('Default admin user already exists');
    }
  } catch (err: any) {
    // User might already exist or table not ready yet - that's ok
    logger.debug(`Could not create default admin user: ${err.message}`);
  }

  // Apply local auth middleware to extract user from JWT
  router.use(localAuthMiddleware(localAuthService));

  /**
   * POST /auth/local/login
   * Login with username/password
   */
  router.post(
    '/auth/local/login',
    asyncHandler(async (req, res) => {
      const { username, password, rememberDevice } = req.body;
      logger.info('POST /auth/local/login');

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required',
        });
      }

      const result = await localAuthService.login(username, password, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        rememberDevice,
      });

      res.json(result);
    })
  );

  /**
   * POST /auth/local/register
   * Register a new local user
   */
  router.post(
    '/auth/local/register',
    asyncHandler(async (req, res) => {
      const { username, email, password, displayName } = req.body;
      logger.info('POST /auth/local/register');

      if (!username || !email || !password) {
        return res.status(400).json({
          error: 'Username, email, and password are required',
        });
      }

      const result = await localAuthService.createUser({
        username,
        email,
        password,
        displayName,
        role: 'user',
      });

      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      res.status(201).json({ user: result.user });
    })
  );

  /**
   * POST /auth/local/refresh
   * Refresh access token
   */
  router.post(
    '/auth/local/refresh',
    asyncHandler(async (req, res) => {
      const { refreshToken } = req.body;
      logger.info('POST /auth/local/refresh');

      if (!refreshToken) {
        return res.status(400).json({ success: false, error: 'Refresh token required' });
      }

      const result = await localAuthService.refreshToken(refreshToken, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json(result);
    })
  );

  /**
   * POST /auth/local/logout
   * Logout and revoke session
   */
  router.post(
    '/auth/local/logout',
    asyncHandler(async (req, res) => {
      const authHeader = req.headers.authorization;
      logger.info('POST /auth/local/logout');

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        await localAuthService.logout(token);
      }

      res.json({ success: true });
    })
  );

  /**
   * GET /auth/local/me
   * Get current user profile
   */
  router.get(
    '/auth/local/me',
    asyncHandler(async (req, res) => {
      const localUser = (req as any).localUser;

      if (!localUser) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      res.json({ user: localUser });
    })
  );

  /**
   * POST /auth/local/change-password
   * Change password for authenticated user
   */
  router.post(
    '/auth/local/change-password',
    asyncHandler(async (req, res) => {
      const { currentPassword, newPassword } = req.body;
      const localUser = (req as any).localUser;
      logger.info('POST /auth/local/change-password');

      if (!localUser) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
      }

      const result = await localAuthService.changePassword(localUser.id, currentPassword, newPassword);
      res.json(result);
    })
  );

  /**
   * POST /auth/guest/login
   * Login as guest user
   */
  router.post(
    '/auth/guest/login',
    asyncHandler(async (req, res) => {
      logger.info('POST /auth/guest/login');

      const authEnvironment = config.getOptionalString('auth.environment') || 'production';
      const guestAllowed = config.getOptionalBoolean('auth.providers.guest.dangerouslyAllowOutsideDevelopment');

      if (authEnvironment !== 'development' && !guestAllowed) {
        return res.status(403).json({ error: 'Guest access is not enabled' });
      }

      // Create a temporary guest session
      res.json({
        success: true,
        user: {
          id: 'guest',
          displayName: 'Guest User',
          email: 'guest@example.com',
          role: 'viewer',
        },
        message: 'Guest access granted',
      });
    })
  );

  // ==========================================
  // GitHub User-Centric Endpoints
  // ==========================================

  /**
   * GET /user/profile
   * Get authenticated user's GitHub profile
   */
  router.get(
    '/user/profile',
    asyncHandler(async (req, res) => {
      logger.info('GET /user/profile');
      const service = getGitHubServiceForRequest(req);

      try {
        const user = await service.getAuthenticatedUser();
        res.json({ user });
      } catch (error) {
        res.status(401).json({ error: 'Not authenticated with GitHub' });
      }
    })
  );

  /**
   * GET /user/repos
   * Get all repositories the user has access to (across all organizations)
   */
  router.get(
    '/user/repos',
    asyncHandler(async (req, res) => {
      const { type = 'all', sort = 'updated', per_page = '50', page = '1' } = req.query;
      logger.info('GET /user/repos');

      const service = getGitHubServiceForRequest(req);

      try {
        const repos = await service.getUserRepositories({
          type: type as 'all' | 'owner' | 'member',
          sort: sort as 'created' | 'updated' | 'pushed' | 'full_name',
          per_page: parseInt(per_page as string, 10),
          page: parseInt(page as string, 10),
        });

        res.json({ repositories: repos, total: repos.length });
      } catch (error) {
        res.status(401).json({ error: 'Failed to fetch user repositories' });
      }
    })
  );

  /**
   * GET /user/pull-requests
   * Get all open pull requests for the authenticated user
   */
  router.get(
    '/user/pull-requests',
    asyncHandler(async (req, res) => {
      const { filter = 'all', state = 'open', per_page = '50' } = req.query;
      logger.info('GET /user/pull-requests');

      const service = getGitHubServiceForRequest(req);

      try {
        const prs = await service.getUserPullRequests({
          filter: filter as 'all' | 'created' | 'assigned' | 'review_requested',
          state: state as 'open' | 'closed' | 'all',
          per_page: parseInt(per_page as string, 10),
        });

        res.json({ pullRequests: prs, total: prs.length });
      } catch (error: any) {
        logger.error('Failed to fetch user PRs', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch pull requests', details: error.message });
      }
    })
  );

  /**
   * GET /user/issues
   * Get issues assigned to or created by the user
   */
  router.get(
    '/user/issues',
    asyncHandler(async (req, res) => {
      const { filter = 'all', state = 'open', per_page = '50' } = req.query;
      logger.info('GET /user/issues');

      const service = getGitHubServiceForRequest(req);

      try {
        const issues = await service.getUserIssues({
          filter: filter as 'all' | 'created' | 'assigned',
          state: state as 'open' | 'closed' | 'all',
          per_page: parseInt(per_page as string, 10),
        });

        res.json({ issues, total: issues.length });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch issues' });
      }
    })
  );

  /**
   * GET /user/organizations
   * Get organizations the user belongs to
   */
  router.get(
    '/user/organizations',
    asyncHandler(async (req, res) => {
      logger.info('GET /user/organizations');
      const service = getGitHubServiceForRequest(req);

      try {
        const orgs = await service.getUserOrganizations();
        res.json({ organizations: orgs, total: orgs.length });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch organizations' });
      }
    })
  );

  /**
   * GET /user/starred
   * Get repositories starred by the user
   */
  router.get(
    '/user/starred',
    asyncHandler(async (req, res) => {
      const { per_page = '30', page = '1' } = req.query;
      logger.info('GET /user/starred');

      const service = getGitHubServiceForRequest(req);

      try {
        const starred = await service.getUserStarredRepos({
          per_page: parseInt(per_page as string, 10),
          page: parseInt(page as string, 10),
        });

        res.json({ repositories: starred, total: starred.length });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch starred repos' });
      }
    })
  );

  /**
   * GET /user/dashboard
   * Get a comprehensive dashboard for the user (PRs, issues, recent activity)
   */
  router.get(
    '/user/dashboard',
    asyncHandler(async (req, res) => {
      logger.info('GET /user/dashboard');
      const service = getGitHubServiceForRequest(req);

      try {
        // Fetch all data in parallel
        const [userProfile, prs, issues, repos, orgs] = await Promise.allSettled([
          service.getAuthenticatedUser(),
          service.getUserPullRequests({ filter: 'all', state: 'open', per_page: 10 }),
          service.getUserIssues({ filter: 'all', state: 'open', per_page: 10 }),
          service.getUserRepositories({ type: 'all', sort: 'updated', per_page: 10 }),
          service.getUserOrganizations(),
        ]);

        res.json({
          user: userProfile.status === 'fulfilled' ? userProfile.value : null,
          pullRequests: prs.status === 'fulfilled' ? prs.value : [],
          issues: issues.status === 'fulfilled' ? issues.value : [],
          recentRepos: repos.status === 'fulfilled' ? repos.value : [],
          organizations: orgs.status === 'fulfilled' ? orgs.value : [],
          stats: {
            openPRs: prs.status === 'fulfilled' ? prs.value.length : 0,
            openIssues: issues.status === 'fulfilled' ? issues.value.length : 0,
            repoCount: repos.status === 'fulfilled' ? repos.value.length : 0,
            orgCount: orgs.status === 'fulfilled' ? orgs.value.length : 0,
          },
        });
      } catch (error: any) {
        logger.error('Dashboard error', { error: error.message });
        res.status(500).json({ error: 'Failed to load dashboard', details: error.message });
      }
    })
  );

  // ==========================================
  // User Profile Management
  // ==========================================

  /**
   * GET /user/settings
   * Get user's saved settings
   */
  router.get(
    '/user/settings',
    asyncHandler(async (req, res) => {
      const userContext = getUserContext(req);
      logger.info('GET /user/settings');

      const settings = await knex('user_settings')
        .where('user_id', userContext.userId)
        .first();

      res.json({
        settings: settings ? JSON.parse(settings.settings_json || '{}') : {},
        defaultOrganization: settings?.default_organization,
        defaultRepository: settings?.default_repository,
        theme: settings?.theme || 'light',
        notifications: settings?.notifications_enabled ?? true,
      });
    })
  );

  /**
   * PUT /user/settings
   * Update user's settings
   */
  router.put(
    '/user/settings',
    asyncHandler(async (req, res) => {
      const userContext = getUserContext(req);
      const { settings, defaultOrganization, defaultRepository, theme, notifications } = req.body;
      logger.info('PUT /user/settings');

      await knex('user_settings')
        .insert({
          user_id: userContext.userId,
          settings_json: JSON.stringify(settings || {}),
          default_organization: defaultOrganization,
          default_repository: defaultRepository,
          theme: theme || 'light',
          notifications_enabled: notifications ?? true,
          updated_at: new Date(),
        })
        .onConflict('user_id')
        .merge();

      res.json({ success: true });
    })
  );

  /**
   * POST /user/link-github
   * Link GitHub account to user profile
   */
  router.post(
    '/user/link-github',
    asyncHandler(async (req, res) => {
      const { githubToken } = req.body;
      const userContext = getUserContext(req);
      logger.info('POST /user/link-github');

      if (!githubToken) {
        return res.status(400).json({ error: 'GitHub token required' });
      }

      // Verify the token by fetching user info
      const tempService = new GitHubService({ token: githubToken, organization: githubOrg });
      
      try {
        const githubUser = await tempService.getAuthenticatedUser();

        // Store the link
        await knex('user_github_links')
          .insert({
            user_id: userContext.userId,
            github_id: githubUser.id.toString(),
            github_username: githubUser.login,
            github_avatar_url: githubUser.avatar_url,
            linked_at: new Date(),
          })
          .onConflict('user_id')
          .merge();

        res.json({
          success: true,
          githubUser: {
            login: githubUser.login,
            avatar_url: githubUser.avatar_url,
          },
        });
      } catch (error) {
        res.status(400).json({ error: 'Invalid GitHub token' });
      }
    })
  );

  logger.info('GitOps backend plugin initialized with all endpoints including Local Auth and User APIs');

  return router;
}
