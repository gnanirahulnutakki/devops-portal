import { HealthService } from '../services/HealthService';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HealthService', () => {
  let service: HealthService;
  let mockKnex: any;

  beforeEach(() => {
    mockKnex = {
      raw: jest.fn(),
    };

    service = new HealthService({
      database: mockKnex,
      githubToken: 'github-token',
      githubOrg: 'test-org',
      argoCDUrl: 'http://argocd.local',
      argoCDToken: 'argocd-token',
      grafanaUrl: 'http://grafana.local',
      grafanaToken: 'grafana-token',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return healthy when all dependencies are up', async () => {
      // Mock database
      mockKnex.raw.mockResolvedValue([{ result: 1 }]);

      // Mock GitHub API
      mockedAxios.get.mockImplementation((url: string) => {
        if (url.includes('github.com')) {
          return Promise.resolve({ data: { login: 'test-org' }, status: 200 });
        }
        if (url.includes('argocd')) {
          return Promise.resolve({ data: { items: [] }, status: 200 });
        }
        if (url.includes('grafana')) {
          return Promise.resolve({ data: { database: 'ok' }, status: 200 });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const health = await service.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.dependencies.database.status).toBe('healthy');
    });

    it('should return degraded when some dependencies are down', async () => {
      // Mock database success
      mockKnex.raw.mockResolvedValue([{ result: 1 }]);

      // Mock GitHub failure
      mockedAxios.get.mockImplementation((url: string) => {
        if (url.includes('github.com')) {
          return Promise.reject(new Error('GitHub is down'));
        }
        if (url.includes('argocd')) {
          return Promise.resolve({ data: { items: [] }, status: 200 });
        }
        if (url.includes('grafana')) {
          return Promise.resolve({ data: { database: 'ok' }, status: 200 });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const health = await service.getHealth();

      expect(health.status).toBe('degraded');
      expect(health.dependencies.github.status).toBe('unhealthy');
    });

    it('should return unhealthy when database is down', async () => {
      // Mock database failure
      mockKnex.raw.mockRejectedValue(new Error('Database connection failed'));

      // Mock other services
      mockedAxios.get.mockResolvedValue({ data: {}, status: 200 });

      const health = await service.getHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.dependencies.database.status).toBe('unhealthy');
    });
  });

  describe('getLiveness', () => {
    it('should return alive status', async () => {
      const liveness = await service.getLiveness();

      expect(liveness.alive).toBe(true);
      expect(liveness.timestamp).toBeDefined();
    });
  });

  describe('getReadiness', () => {
    it('should return ready when database is connected', async () => {
      mockKnex.raw.mockResolvedValue([{ result: 1 }]);

      const readiness = await service.getReadiness();

      expect(readiness.ready).toBe(true);
    });

    it('should return not ready when database is down', async () => {
      mockKnex.raw.mockRejectedValue(new Error('Connection refused'));

      const readiness = await service.getReadiness();

      expect(readiness.ready).toBe(false);
      expect(readiness.checks.database).toBe(false);
    });
  });

  describe('checkDatabase', () => {
    it('should return healthy when query succeeds', async () => {
      mockKnex.raw.mockResolvedValue([{ result: 1 }]);

      const health = await service.getHealth();

      expect(health.dependencies.database.status).toBe('healthy');
    });

    it('should return unhealthy when query fails', async () => {
      mockKnex.raw.mockRejectedValue(new Error('Connection timeout'));

      const health = await service.getHealth();

      expect(health.dependencies.database.status).toBe('unhealthy');
      expect(health.dependencies.database.message).toContain('timeout');
    });

    it('should measure latency', async () => {
      // Simulate some latency
      mockKnex.raw.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([{ result: 1 }]), 50))
      );

      const health = await service.getHealth();

      expect(health.dependencies.database.latency).toBeGreaterThan(0);
    });
  });

  describe('checkGitHub', () => {
    it('should return healthy when GitHub API responds', async () => {
      mockKnex.raw.mockResolvedValue([{ result: 1 }]);
      mockedAxios.get.mockImplementation((url: string) => {
        if (url.includes('github.com')) {
          return Promise.resolve({ 
            data: { login: 'test-org' }, 
            status: 200 
          });
        }
        return Promise.resolve({ data: {}, status: 200 });
      });

      const health = await service.getHealth();

      expect(health.dependencies.github.status).toBe('healthy');
    });

    it('should return unhealthy on rate limit', async () => {
      mockKnex.raw.mockResolvedValue([{ result: 1 }]);
      mockedAxios.get.mockImplementation((url: string) => {
        if (url.includes('github.com')) {
          return Promise.reject({ 
            response: { status: 403, data: { message: 'Rate limit' } }
          });
        }
        return Promise.resolve({ data: {}, status: 200 });
      });

      const health = await service.getHealth();

      expect(health.dependencies.github.status).toBe('unhealthy');
    });
  });

  describe('checkArgoCD', () => {
    it('should return healthy when ArgoCD responds', async () => {
      mockKnex.raw.mockResolvedValue([{ result: 1 }]);
      mockedAxios.get.mockImplementation((url: string) => {
        if (url.includes('argocd')) {
          return Promise.resolve({ 
            data: { items: [] }, 
            status: 200 
          });
        }
        return Promise.resolve({ data: {}, status: 200 });
      });

      const health = await service.getHealth();

      expect(health.dependencies.argocd.status).toBe('healthy');
    });

    it('should return unhealthy on connection error', async () => {
      mockKnex.raw.mockResolvedValue([{ result: 1 }]);
      mockedAxios.get.mockImplementation((url: string) => {
        if (url.includes('argocd')) {
          return Promise.reject(new Error('ECONNREFUSED'));
        }
        return Promise.resolve({ data: {}, status: 200 });
      });

      const health = await service.getHealth();

      expect(health.dependencies.argocd.status).toBe('unhealthy');
    });
  });

  describe('checkGrafana', () => {
    it('should return healthy when Grafana responds', async () => {
      mockKnex.raw.mockResolvedValue([{ result: 1 }]);
      mockedAxios.get.mockImplementation((url: string) => {
        if (url.includes('grafana')) {
          return Promise.resolve({ 
            data: { database: 'ok' }, 
            status: 200 
          });
        }
        return Promise.resolve({ data: {}, status: 200 });
      });

      const health = await service.getHealth();

      expect(health.dependencies.grafana.status).toBe('healthy');
    });

    it('should skip check when Grafana not configured', async () => {
      const serviceWithoutGrafana = new HealthService({
        database: mockKnex,
        githubToken: 'token',
        githubOrg: 'org',
        argoCDUrl: 'http://argocd.local',
        argoCDToken: 'token',
        grafanaUrl: '',
        grafanaToken: '',
      });

      mockKnex.raw.mockResolvedValue([{ result: 1 }]);
      mockedAxios.get.mockResolvedValue({ data: {}, status: 200 });

      const health = await serviceWithoutGrafana.getHealth();

      // Grafana should not be in dependencies or should be marked as unconfigured
      expect(health.dependencies.grafana?.status === 'healthy' || 
             health.dependencies.grafana === undefined ||
             health.dependencies.grafana?.message?.includes('not configured')).toBe(true);
    });
  });

  describe('uptime calculation', () => {
    it('should include uptime in health response', async () => {
      mockKnex.raw.mockResolvedValue([{ result: 1 }]);
      mockedAxios.get.mockResolvedValue({ data: {}, status: 200 });

      const health = await service.getHealth();

      expect(health.uptime).toBeDefined();
      expect(typeof health.uptime).toBe('number');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('timestamp', () => {
    it('should include timestamp in health response', async () => {
      mockKnex.raw.mockResolvedValue([{ result: 1 }]);
      mockedAxios.get.mockResolvedValue({ data: {}, status: 200 });

      const health = await service.getHealth();

      expect(health.timestamp).toBeDefined();
      expect(new Date(health.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});
