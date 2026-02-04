import { Knex } from 'knex';
import { AuditService } from '../services/AuditService';

// Mock Knex
const createMockKnex = () => {
  const insertedData: any[] = [];
  const mockQuery = {
    insert: jest.fn().mockImplementation((data) => {
      insertedData.push(data);
      return Promise.resolve([data.id]);
    }),
    where: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnValue({
      first: jest.fn().mockResolvedValue({ count: 10 }),
    }),
    select: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue([]),
    first: jest.fn().mockResolvedValue({ count: 10 }),
    whereBetween: jest.fn().mockReturnThis(),
  };

  const knex = jest.fn().mockReturnValue(mockQuery) as unknown as Knex;
  (knex as any)._insertedData = insertedData;
  (knex as any)._mockQuery = mockQuery;

  return knex;
};

describe('AuditService', () => {
  let service: AuditService;
  let mockKnex: Knex;

  beforeEach(() => {
    mockKnex = createMockKnex();
    service = new AuditService({ database: mockKnex });
  });

  describe('log', () => {
    it('should insert audit log entry', async () => {
      const id = await service.log({
        user_id: 'user-123',
        operation: 'read',
        resource_type: 'file',
        resource_id: 'test-file.yaml',
        status: 'success',
      });

      expect(id).toBeDefined();
      expect(mockKnex).toHaveBeenCalledWith('audit_logs');
    });

    it('should generate UUID for log entry', async () => {
      const id = await service.log({
        user_id: 'user-123',
        operation: 'update',
        resource_type: 'branch',
        resource_id: 'main',
        status: 'success',
      });

      // UUID v4 format check
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('logRead', () => {
    it('should log read operation', async () => {
      const id = await service.logRead({
        user_id: 'user-123',
        resource_type: 'file',
        resource_id: 'values.yaml',
        repository: 'rli-use2',
        branch: 'master',
      });

      expect(id).toBeDefined();
      const insertedData = (mockKnex as any)._insertedData;
      expect(insertedData[0]).toMatchObject({
        operation: 'read',
        status: 'success',
      });
    });
  });

  describe('logUpdate', () => {
    it('should log update operation with diff', async () => {
      const id = await service.logUpdate({
        user_id: 'user-123',
        resource_type: 'file',
        resource_id: 'values.yaml',
        repository: 'rli-use2',
        branch: 'master',
        file_path: 'app/charts/radiantone/values.yaml',
        old_value: 'tag: v1.0.0',
        new_value: 'tag: v1.1.0',
        status: 'success',
      });

      expect(id).toBeDefined();
    });
  });

  describe('logCommit', () => {
    it('should log commit operation with SHA', async () => {
      const id = await service.logCommit({
        user_id: 'user-123',
        resource_type: 'branch',
        resource_id: 'master',
        repository: 'rli-use2',
        branch: 'master',
        commit_sha: 'abc123def456',
        status: 'success',
      });

      expect(id).toBeDefined();
      const insertedData = (mockKnex as any)._insertedData;
      expect(insertedData[0]).toMatchObject({
        operation: 'commit',
        commit_sha: 'abc123def456',
      });
    });
  });

  describe('logSync', () => {
    it('should log ArgoCD sync operation', async () => {
      const id = await service.logSync({
        user_id: 'user-123',
        resource_type: 'argocd_app',
        resource_id: 'rli-use2-mp02',
        argocd_app_name: 'rli-use2-mp02',
        sync_status: 'Synced',
        status: 'success',
      });

      expect(id).toBeDefined();
      const insertedData = (mockKnex as any)._insertedData;
      expect(insertedData[0]).toMatchObject({
        operation: 'sync',
        argocd_app_name: 'rli-use2-mp02',
      });
    });
  });

  describe('getLogs', () => {
    it('should query logs with filters', async () => {
      const result = await service.getLogs({
        user_id: 'user-123',
        operation: 'commit',
        limit: 50,
      });

      expect(result).toBeDefined();
      expect(result.total).toBeDefined();
      expect(result.logs).toBeDefined();
    });

    it('should apply date range filters', async () => {
      const result = await service.getLogs({
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
      });

      expect(result).toBeDefined();
    });
  });

  describe('getStatistics', () => {
    it('should calculate statistics for time period', async () => {
      const stats = await service.getStatistics({
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
      });

      expect(stats).toBeDefined();
      expect(stats.total_operations).toBeDefined();
      expect(stats.operations_by_type).toBeDefined();
    });
  });
});
