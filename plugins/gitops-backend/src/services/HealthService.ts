import { Knex } from 'knex';
import axios from 'axios';
import logger from '../utils/logger';

/**
 * Comprehensive Health Check Service
 * 
 * Checks health of all dependencies:
 * - Database (PostgreSQL)
 * - GitHub API
 * - ArgoCD API
 * - Grafana API (if configured)
 */

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    [key: string]: {
      status: 'up' | 'down' | 'degraded';
      latencyMs?: number;
      message?: string;
      details?: Record<string, any>;
    };
  };
}

export interface HealthServiceConfig {
  database: Knex;
  githubToken?: string;
  githubOrg?: string;
  argoCDUrl?: string;
  argoCDToken?: string;
  grafanaUrl?: string;
  grafanaToken?: string;
}

const startTime = Date.now();

export class HealthService {
  private config: HealthServiceConfig;
  private cachedHealth: HealthStatus | null = null;
  private cacheTime: number = 0;
  private readonly cacheTTL = 10000; // 10 seconds

  constructor(config: HealthServiceConfig) {
    this.config = config;
  }

  /**
   * Get full health status
   */
  async getHealth(forceRefresh = false): Promise<HealthStatus> {
    const now = Date.now();
    
    // Return cached result if fresh
    if (!forceRefresh && this.cachedHealth && (now - this.cacheTime) < this.cacheTTL) {
      return this.cachedHealth;
    }

    const checks: HealthStatus['checks'] = {};

    // Run all checks in parallel
    const [dbCheck, githubCheck, argoCDCheck, grafanaCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkGitHub(),
      this.checkArgoCD(),
      this.checkGrafana(),
    ]);

    checks.database = dbCheck;
    checks.github = githubCheck;
    
    if (this.config.argoCDUrl && this.config.argoCDToken) {
      checks.argocd = argoCDCheck;
    }
    
    if (this.config.grafanaUrl && this.config.grafanaToken) {
      checks.grafana = grafanaCheck;
    }

    // Determine overall status
    const allChecks = Object.values(checks);
    const hasDown = allChecks.some(c => c.status === 'down');
    const hasDegraded = allChecks.some(c => c.status === 'degraded');

    const status: HealthStatus = {
      status: hasDown ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor((now - startTime) / 1000),
      checks,
    };

    // Cache result
    this.cachedHealth = status;
    this.cacheTime = now;

    return status;
  }

  /**
   * Get liveness check (is the service running?)
   */
  async getLiveness(): Promise<{ status: 'ok' }> {
    return { status: 'ok' };
  }

  /**
   * Get readiness check (is the service ready to accept traffic?)
   */
  async getReadiness(): Promise<{ ready: boolean; message?: string }> {
    try {
      // Check database is accessible
      await this.config.database.raw('SELECT 1');
      return { ready: true };
    } catch (error: any) {
      return { ready: false, message: error.message };
    }
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<HealthStatus['checks'][string]> {
    const start = Date.now();
    try {
      await this.config.database.raw('SELECT 1');
      
      // Check table counts for more detail
      const [auditCount, bulkOpsCount] = await Promise.all([
        this.config.database('audit_logs').count('* as count').first(),
        this.config.database('bulk_operations').count('* as count').first(),
      ]);

      return {
        status: 'up',
        latencyMs: Date.now() - start,
        details: {
          auditLogsCount: Number(auditCount?.count || 0),
          bulkOperationsCount: Number(bulkOpsCount?.count || 0),
        },
      };
    } catch (error: any) {
      logger.error('Database health check failed', { error: error.message });
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: error.message,
      };
    }
  }

  /**
   * Check GitHub API connectivity
   */
  private async checkGitHub(): Promise<HealthStatus['checks'][string]> {
    if (!this.config.githubToken || this.config.githubToken === 'your_github_personal_access_token') {
      return {
        status: 'degraded',
        message: 'GitHub token not configured (using mock mode)',
      };
    }

    const start = Date.now();
    try {
      const response = await axios.get('https://api.github.com/rate_limit', {
        headers: {
          Authorization: `token ${this.config.githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 5000,
      });

      const rateLimit = response.data.resources.core;
      const percentUsed = ((rateLimit.limit - rateLimit.remaining) / rateLimit.limit) * 100;

      return {
        status: percentUsed > 90 ? 'degraded' : 'up',
        latencyMs: Date.now() - start,
        details: {
          rateLimit: rateLimit.limit,
          remaining: rateLimit.remaining,
          resetsAt: new Date(rateLimit.reset * 1000).toISOString(),
          percentUsed: percentUsed.toFixed(1) + '%',
        },
        message: percentUsed > 90 ? 'Rate limit nearly exhausted' : undefined,
      };
    } catch (error: any) {
      logger.error('GitHub health check failed', { error: error.message });
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: error.message,
      };
    }
  }

  /**
   * Check ArgoCD API connectivity
   */
  private async checkArgoCD(): Promise<HealthStatus['checks'][string]> {
    if (!this.config.argoCDUrl || !this.config.argoCDToken || 
        this.config.argoCDToken === 'your_argocd_token') {
      return {
        status: 'degraded',
        message: 'ArgoCD not configured (using mock mode)',
      };
    }

    const start = Date.now();
    try {
      const response = await axios.get(`${this.config.argoCDUrl}/api/v1/applications`, {
        headers: {
          Authorization: `Bearer ${this.config.argoCDToken}`,
        },
        timeout: 5000,
        params: { limit: 1 }, // Just check connectivity
      });

      const appCount = response.data.items?.length || 0;

      return {
        status: 'up',
        latencyMs: Date.now() - start,
        details: {
          applicationCount: appCount,
          url: this.config.argoCDUrl,
        },
      };
    } catch (error: any) {
      logger.error('ArgoCD health check failed', { error: error.message });
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: error.message,
      };
    }
  }

  /**
   * Check Grafana API connectivity
   */
  private async checkGrafana(): Promise<HealthStatus['checks'][string]> {
    if (!this.config.grafanaUrl || !this.config.grafanaToken) {
      return {
        status: 'degraded',
        message: 'Grafana not configured',
      };
    }

    const start = Date.now();
    try {
      const response = await axios.get(`${this.config.grafanaUrl}/api/health`, {
        headers: {
          Authorization: `Bearer ${this.config.grafanaToken}`,
        },
        timeout: 5000,
      });

      return {
        status: response.data.database === 'ok' ? 'up' : 'degraded',
        latencyMs: Date.now() - start,
        details: {
          version: response.data.version,
          database: response.data.database,
        },
      };
    } catch (error: any) {
      logger.error('Grafana health check failed', { error: error.message });
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: error.message,
      };
    }
  }
}
