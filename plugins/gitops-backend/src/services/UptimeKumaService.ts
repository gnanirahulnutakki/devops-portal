/**
 * UptimeKumaService - Integration with Uptime Kuma monitoring
 * 
 * Uptime Kuma is a self-hosted monitoring tool for tracking uptime of services.
 * This service integrates with its API to provide status dashboards and alerts.
 * 
 * @see https://github.com/louislam/uptime-kuma
 */

import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

export interface UptimeKumaConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  apiKey?: string;
  timeout?: number;
}

export interface Monitor {
  id: number;
  name: string;
  type: MonitorType;
  url?: string;
  hostname?: string;
  port?: number;
  active: boolean;
  interval: number;
  retryInterval: number;
  maxretries: number;
  accepted_statuscodes: string[];
  tags: Tag[];
  notificationIDList: Record<string, boolean>;
}

export type MonitorType = 
  | 'http'
  | 'https'
  | 'tcp'
  | 'ping'
  | 'dns'
  | 'docker'
  | 'push'
  | 'steam'
  | 'gamedig'
  | 'mqtt'
  | 'keyword'
  | 'grpc-keyword'
  | 'json-query'
  | 'real-browser';

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Heartbeat {
  monitorID: number;
  status: 0 | 1 | 2 | 3; // DOWN, UP, PENDING, MAINTENANCE
  time: string;
  msg: string;
  ping?: number;
  duration: number;
}

export interface MonitorStatus {
  monitor: Monitor;
  heartbeat?: Heartbeat;
  uptime24h?: number;
  uptime30d?: number;
  avgPing?: number;
  certInfo?: CertificateInfo;
}

export interface CertificateInfo {
  valid: boolean;
  certInfo?: {
    issuer: string;
    subject: string;
    validFrom: string;
    validTo: string;
    daysRemaining: number;
  };
}

export interface StatusPage {
  id: number;
  slug: string;
  title: string;
  description?: string;
  icon?: string;
  theme: string;
  published: boolean;
  showTags: boolean;
  domainNameList: string[];
}

export interface Notification {
  id: number;
  name: string;
  type: string;
  active: boolean;
  isDefault: boolean;
}

export interface UptimeStats {
  totalMonitors: number;
  upMonitors: number;
  downMonitors: number;
  pendingMonitors: number;
  maintenanceMonitors: number;
  averageUptime24h: number;
  averageUptime30d: number;
}

/**
 * Uptime Kuma API client
 * 
 * Note: Uptime Kuma uses Socket.IO for real-time updates,
 * but also exposes a REST-like API for some operations.
 */
export class UptimeKumaService {
  private client: AxiosInstance;
  private baseUrl: string;
  private authenticated: boolean = false;
  private sessionToken?: string;

  constructor(config: UptimeKumaConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    // If API key provided, use it
    if (config.apiKey) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${config.apiKey}`;
      this.authenticated = true;
    }

    logger.info('[UptimeKumaService] Initialized', { 
      baseUrl: this.baseUrl,
      hasApiKey: !!config.apiKey,
    });
  }

  /**
   * Authenticate with username/password
   */
  async login(username: string, password: string): Promise<boolean> {
    try {
      const response = await this.client.post('/api/auth/login', {
        username,
        password,
      });

      if (response.data.token) {
        this.sessionToken = response.data.token;
        this.client.defaults.headers.common['Authorization'] = `Bearer ${this.sessionToken}`;
        this.authenticated = true;
        logger.info('[UptimeKumaService] Login successful');
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('[UptimeKumaService] Login failed', { error: error.message });
      return false;
    }
  }

  /**
   * Get all monitors
   */
  async getMonitors(): Promise<Monitor[]> {
    try {
      const response = await this.client.get('/api/monitor');
      return response.data.monitors || [];
    } catch (error: any) {
      logger.error('[UptimeKumaService] Failed to get monitors', { error: error.message });
      throw error;
    }
  }

  /**
   * Get a specific monitor by ID
   */
  async getMonitor(id: number): Promise<Monitor> {
    const response = await this.client.get(`/api/monitor/${id}`);
    return response.data.monitor;
  }

  /**
   * Get monitor status with heartbeat info
   */
  async getMonitorStatus(id: number): Promise<MonitorStatus> {
    const [monitor, heartbeats] = await Promise.all([
      this.getMonitor(id),
      this.getHeartbeats(id, 1),
    ]);

    const uptime24h = await this.getUptime(id, 24);
    const uptime30d = await this.getUptime(id, 720); // 30 days in hours

    return {
      monitor,
      heartbeat: heartbeats[0],
      uptime24h,
      uptime30d,
    };
  }

  /**
   * Get heartbeats for a monitor
   */
  async getHeartbeats(monitorId: number, hours: number = 24): Promise<Heartbeat[]> {
    try {
      const response = await this.client.get(`/api/monitor/${monitorId}/heartbeat`, {
        params: { hours },
      });
      return response.data.heartbeatList || [];
    } catch (error: any) {
      logger.error('[UptimeKumaService] Failed to get heartbeats', { 
        monitorId, 
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Calculate uptime percentage for a monitor
   */
  async getUptime(monitorId: number, hours: number): Promise<number> {
    try {
      const response = await this.client.get(`/api/monitor/${monitorId}/uptime`, {
        params: { hours },
      });
      return response.data.uptime || 0;
    } catch (error) {
      // Calculate from heartbeats if endpoint not available
      const heartbeats = await this.getHeartbeats(monitorId, hours);
      if (heartbeats.length === 0) return 0;

      const upCount = heartbeats.filter(h => h.status === 1).length;
      return (upCount / heartbeats.length) * 100;
    }
  }

  /**
   * Create a new monitor
   */
  async createMonitor(monitor: Partial<Monitor>): Promise<Monitor> {
    const response = await this.client.post('/api/monitor', monitor);
    return response.data.monitor;
  }

  /**
   * Update a monitor
   */
  async updateMonitor(id: number, updates: Partial<Monitor>): Promise<Monitor> {
    const response = await this.client.patch(`/api/monitor/${id}`, updates);
    return response.data.monitor;
  }

  /**
   * Delete a monitor
   */
  async deleteMonitor(id: number): Promise<void> {
    await this.client.delete(`/api/monitor/${id}`);
  }

  /**
   * Pause a monitor
   */
  async pauseMonitor(id: number): Promise<void> {
    await this.client.post(`/api/monitor/${id}/pause`);
  }

  /**
   * Resume a monitor
   */
  async resumeMonitor(id: number): Promise<void> {
    await this.client.post(`/api/monitor/${id}/resume`);
  }

  /**
   * Get all status pages
   */
  async getStatusPages(): Promise<StatusPage[]> {
    try {
      const response = await this.client.get('/api/status-page');
      return response.data.statusPages || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get public status page data (no auth required)
   */
  async getPublicStatusPage(slug: string): Promise<{
    config: StatusPage;
    incident: any;
    publicGroupList: any[];
  }> {
    const response = await this.client.get(`/api/status-page/${slug}`);
    return response.data;
  }

  /**
   * Get all notifications
   */
  async getNotifications(): Promise<Notification[]> {
    try {
      const response = await this.client.get('/api/notification');
      return response.data.notifications || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get all tags
   */
  async getTags(): Promise<Tag[]> {
    try {
      const response = await this.client.get('/api/tag');
      return response.data.tags || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get overall uptime statistics
   */
  async getStats(): Promise<UptimeStats> {
    const monitors = await this.getMonitors();
    
    let upCount = 0;
    let downCount = 0;
    let pendingCount = 0;
    let maintenanceCount = 0;
    let totalUptime24h = 0;
    let totalUptime30d = 0;

    // Get status for each monitor
    const statuses = await Promise.all(
      monitors.slice(0, 50).map(async (m) => { // Limit to 50 to avoid rate limiting
        try {
          return await this.getMonitorStatus(m.id);
        } catch {
          return null;
        }
      })
    );

    for (const status of statuses) {
      if (!status) continue;

      if (status.heartbeat) {
        switch (status.heartbeat.status) {
          case 1: upCount++; break;
          case 0: downCount++; break;
          case 2: pendingCount++; break;
          case 3: maintenanceCount++; break;
        }
      }

      if (status.uptime24h) totalUptime24h += status.uptime24h;
      if (status.uptime30d) totalUptime30d += status.uptime30d;
    }

    const activeCount = statuses.filter(s => s).length;

    return {
      totalMonitors: monitors.length,
      upMonitors: upCount,
      downMonitors: downCount,
      pendingMonitors: pendingCount,
      maintenanceMonitors: maintenanceCount,
      averageUptime24h: activeCount > 0 ? totalUptime24h / activeCount : 0,
      averageUptime30d: activeCount > 0 ? totalUptime30d / activeCount : 0,
    };
  }

  /**
   * Get monitors by tag
   */
  async getMonitorsByTag(tagName: string): Promise<Monitor[]> {
    const monitors = await this.getMonitors();
    return monitors.filter(m => m.tags.some(t => t.name === tagName));
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string; version?: string }> {
    try {
      const response = await this.client.get('/api/info');
      return { 
        healthy: true, 
        message: 'Uptime Kuma connection OK',
        version: response.data.version,
      };
    } catch (error: any) {
      return { 
        healthy: false, 
        message: `Uptime Kuma connection failed: ${error.message}` 
      };
    }
  }

  /**
   * Quick status summary for dashboard
   */
  async getDashboardSummary(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    upCount: number;
    downCount: number;
    totalCount: number;
    uptimePercent: number;
  }> {
    const stats = await this.getStats();
    
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (stats.downMonitors > 0 && stats.downMonitors < stats.totalMonitors) {
      status = 'degraded';
    } else if (stats.downMonitors === stats.totalMonitors && stats.totalMonitors > 0) {
      status = 'down';
    }

    return {
      status,
      upCount: stats.upMonitors,
      downCount: stats.downMonitors,
      totalCount: stats.totalMonitors,
      uptimePercent: stats.averageUptime24h,
    };
  }
}

export default UptimeKumaService;
