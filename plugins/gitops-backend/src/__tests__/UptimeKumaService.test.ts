import { UptimeKumaService } from '../services/UptimeKumaService';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('UptimeKumaService', () => {
  let service: UptimeKumaService;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      defaults: { headers: { common: {} } },
    };
    mockedAxios.create.mockReturnValue(mockClient as any);

    service = new UptimeKumaService({
      baseUrl: 'https://uptime.example.com',
      apiKey: 'test-api-key',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with API key', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://uptime.example.com',
        })
      );
    });

    it('should trim trailing slash from baseUrl', () => {
      new UptimeKumaService({
        baseUrl: 'https://uptime.example.com/',
      });

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://uptime.example.com',
        })
      );
    });
  });

  describe('login', () => {
    it('should login successfully with username/password', async () => {
      mockClient.post.mockResolvedValue({
        data: { token: 'session-token' },
      });

      const result = await service.login('admin', 'password');

      expect(mockClient.post).toHaveBeenCalledWith('/api/auth/login', {
        username: 'admin',
        password: 'password',
      });
      expect(result).toBe(true);
    });

    it('should return false on login failure', async () => {
      mockClient.post.mockRejectedValue(new Error('Invalid credentials'));

      const result = await service.login('admin', 'wrong');

      expect(result).toBe(false);
    });
  });

  describe('getMonitors', () => {
    it('should list all monitors', async () => {
      const mockMonitors = [
        { id: 1, name: 'Website', type: 'http', active: true },
        { id: 2, name: 'API', type: 'https', active: true },
      ];
      mockClient.get.mockResolvedValue({ data: { monitors: mockMonitors } });

      const result = await service.getMonitors();

      expect(mockClient.get).toHaveBeenCalledWith('/api/monitor');
      expect(result).toEqual(mockMonitors);
    });

    it('should return empty array on error', async () => {
      mockClient.get.mockRejectedValue(new Error('Server error'));

      await expect(service.getMonitors()).rejects.toThrow();
    });
  });

  describe('getMonitor', () => {
    it('should get monitor by ID', async () => {
      const mockMonitor = { id: 1, name: 'Website', type: 'http' };
      mockClient.get.mockResolvedValue({ data: { monitor: mockMonitor } });

      const result = await service.getMonitor(1);

      expect(mockClient.get).toHaveBeenCalledWith('/api/monitor/1');
      expect(result).toEqual(mockMonitor);
    });
  });

  describe('getHeartbeats', () => {
    it('should get heartbeats for a monitor', async () => {
      const mockHeartbeats = [
        { monitorID: 1, status: 1, time: '2024-01-01T00:00:00Z' },
        { monitorID: 1, status: 1, time: '2024-01-01T00:01:00Z' },
      ];
      mockClient.get.mockResolvedValue({ data: { heartbeatList: mockHeartbeats } });

      const result = await service.getHeartbeats(1, 24);

      expect(mockClient.get).toHaveBeenCalledWith('/api/monitor/1/heartbeat', {
        params: { hours: 24 },
      });
      expect(result).toEqual(mockHeartbeats);
    });

    it('should return empty array on error', async () => {
      mockClient.get.mockRejectedValue(new Error('Not found'));

      const result = await service.getHeartbeats(1);

      expect(result).toEqual([]);
    });
  });

  describe('getMonitorStatus', () => {
    it('should get full monitor status', async () => {
      const mockMonitor = { id: 1, name: 'Website' };
      const mockHeartbeats = [{ monitorID: 1, status: 1 }];

      mockClient.get
        .mockResolvedValueOnce({ data: { monitor: mockMonitor } }) // getMonitor
        .mockResolvedValueOnce({ data: { heartbeatList: mockHeartbeats } }) // getHeartbeats
        .mockResolvedValueOnce({ data: { uptime: 99.5 } }) // getUptime 24h
        .mockResolvedValueOnce({ data: { uptime: 99.9 } }); // getUptime 30d

      const result = await service.getMonitorStatus(1);

      expect(result.monitor).toEqual(mockMonitor);
      expect(result.heartbeat).toEqual(mockHeartbeats[0]);
    });
  });

  describe('createMonitor', () => {
    it('should create a new monitor', async () => {
      const mockMonitor = { id: 1, name: 'New Monitor' };
      mockClient.post.mockResolvedValue({ data: { monitor: mockMonitor } });

      const result = await service.createMonitor({
        name: 'New Monitor',
        type: 'http',
        url: 'https://example.com',
      });

      expect(mockClient.post).toHaveBeenCalledWith('/api/monitor', {
        name: 'New Monitor',
        type: 'http',
        url: 'https://example.com',
      });
      expect(result).toEqual(mockMonitor);
    });
  });

  describe('updateMonitor', () => {
    it('should update a monitor', async () => {
      const mockMonitor = { id: 1, name: 'Updated Monitor' };
      mockClient.patch.mockResolvedValue({ data: { monitor: mockMonitor } });

      const result = await service.updateMonitor(1, { name: 'Updated Monitor' });

      expect(mockClient.patch).toHaveBeenCalledWith('/api/monitor/1', {
        name: 'Updated Monitor',
      });
      expect(result).toEqual(mockMonitor);
    });
  });

  describe('deleteMonitor', () => {
    it('should delete a monitor', async () => {
      mockClient.delete.mockResolvedValue({ data: {} });

      await service.deleteMonitor(1);

      expect(mockClient.delete).toHaveBeenCalledWith('/api/monitor/1');
    });
  });

  describe('pauseMonitor / resumeMonitor', () => {
    it('should pause a monitor', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await service.pauseMonitor(1);

      expect(mockClient.post).toHaveBeenCalledWith('/api/monitor/1/pause');
    });

    it('should resume a monitor', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await service.resumeMonitor(1);

      expect(mockClient.post).toHaveBeenCalledWith('/api/monitor/1/resume');
    });
  });

  describe('getStatusPages', () => {
    it('should list status pages', async () => {
      const mockStatusPages = [
        { id: 1, slug: 'status', title: 'Status Page' },
      ];
      mockClient.get.mockResolvedValue({ data: { statusPages: mockStatusPages } });

      const result = await service.getStatusPages();

      expect(mockClient.get).toHaveBeenCalledWith('/api/status-page');
      expect(result).toEqual(mockStatusPages);
    });
  });

  describe('getTags', () => {
    it('should list tags', async () => {
      const mockTags = [
        { id: 1, name: 'production', color: '#ff0000' },
        { id: 2, name: 'staging', color: '#00ff00' },
      ];
      mockClient.get.mockResolvedValue({ data: { tags: mockTags } });

      const result = await service.getTags();

      expect(mockClient.get).toHaveBeenCalledWith('/api/tag');
      expect(result).toEqual(mockTags);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when Uptime Kuma is accessible', async () => {
      mockClient.get.mockResolvedValue({ data: { version: '1.21.0' } });

      const result = await service.healthCheck();

      expect(result).toEqual({
        healthy: true,
        message: 'Uptime Kuma connection OK',
        version: '1.21.0',
      });
    });

    it('should return unhealthy when Uptime Kuma is not accessible', async () => {
      mockClient.get.mockRejectedValue(new Error('Connection refused'));

      const result = await service.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Uptime Kuma connection failed: Connection refused',
      });
    });
  });

  describe('getDashboardSummary', () => {
    it('should return healthy status when all monitors are up', async () => {
      // Mock getStats implementation
      mockClient.get
        .mockResolvedValueOnce({ data: { monitors: [{ id: 1 }] } }) // getMonitors
        .mockResolvedValueOnce({ data: { monitor: { id: 1 } } }) // getMonitor
        .mockResolvedValueOnce({ data: { heartbeatList: [{ status: 1 }] } }) // getHeartbeats
        .mockResolvedValueOnce({ data: { uptime: 100 } }) // getUptime 24h
        .mockResolvedValueOnce({ data: { uptime: 99.9 } }); // getUptime 30d

      const result = await service.getDashboardSummary();

      expect(result.status).toBe('healthy');
    });
  });

  describe('getMonitorsByTag', () => {
    it('should filter monitors by tag', async () => {
      const mockMonitors = [
        { id: 1, name: 'Web', tags: [{ id: 1, name: 'production', color: '#f00' }] },
        { id: 2, name: 'API', tags: [{ id: 2, name: 'staging', color: '#0f0' }] },
      ];
      mockClient.get.mockResolvedValue({ data: { monitors: mockMonitors } });

      const result = await service.getMonitorsByTag('production');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Web');
    });
  });
});
