import { GitHubService } from '../services/GitHubService';

describe('GitHubService', () => {
  let service: GitHubService;

  beforeEach(() => {
    // Initialize with mock mode (no token)
    service = new GitHubService({
      token: '',
      organization: 'radiantlogic-saas',
    });
  });

  describe('Mock Mode', () => {
    it('should use mock data when no token provided', async () => {
      const repos = await service.listRepositories();
      expect(repos).toBeDefined();
      expect(Array.isArray(repos)).toBe(true);
      expect(repos.length).toBeGreaterThan(0);
    });

    it('should list mock repositories', async () => {
      const repos = await service.listRepositories();
      expect(repos).toContainEqual(
        expect.objectContaining({
          name: 'rli-use2',
          full_name: 'radiantlogic-saas/rli-use2',
        })
      );
    });

    it('should filter repositories by name', async () => {
      const repos = await service.listRepositories('rli');
      expect(repos.every(r => r.name.includes('rli'))).toBe(true);
    });

    it('should list mock branches', async () => {
      const branches = await service.listBranches('rli-use2');
      expect(branches).toBeDefined();
      expect(branches.length).toBeGreaterThan(0);
      expect(branches).toContainEqual(
        expect.objectContaining({
          name: 'master',
          protected: true,
        })
      );
    });

    it('should filter branches by name', async () => {
      const branches = await service.listBranches('rli-use2', 'mp');
      expect(branches.every(b => b.name.includes('mp') || b.name === 'master')).toBe(true);
    });

    it('should get mock file tree', async () => {
      const tree = await service.getFileTree('rli-use2', 'master', '');
      expect(tree).toBeDefined();
      expect(tree.length).toBeGreaterThan(0);
    });

    it('should get mock file content', async () => {
      const content = await service.getFileContent(
        'rli-use2',
        'master',
        'app/charts/radiantone/values.yaml'
      );
      expect(content).toBeDefined();
      expect(content.content).toBeDefined();
      expect(content.sha).toBeDefined();
      expect(content.encoding).toBe('base64');
    });

    it('should decode base64 content correctly', async () => {
      const content = await service.getFileContent(
        'rli-use2',
        'master',
        'app/charts/radiantone/values.yaml'
      );
      const decoded = Buffer.from(content.content, 'base64').toString('utf-8');
      expect(decoded).toContain('fid:');
      expect(decoded).toContain('image:');
    });

    it('should update file and return mock response', async () => {
      const result = await service.updateFile({
        repository: 'rli-use2',
        branch: 'master',
        path: 'app/charts/radiantone/values.yaml',
        content: Buffer.from('test: value').toString('base64'),
        message: 'Test commit',
        sha: 'abc123',
      });

      expect(result).toBeDefined();
      expect(result.commit).toBeDefined();
      expect(result.commit.sha).toBeDefined();
      expect(result.commit.message).toBe('Test commit');
    });
  });

  describe('Pull Request Operations', () => {
    it('should list mock pull requests', async () => {
      const prs = await service.listPullRequests('rli-use2');
      expect(prs).toBeDefined();
      expect(Array.isArray(prs)).toBe(true);
    });

    it('should get mock pull request details', async () => {
      const pr = await service.getPullRequest('rli-use2', 42);
      expect(pr).toBeDefined();
      expect(pr.number).toBe(42);
      expect(pr.state).toBeDefined();
    });

    it('should create mock branch', async () => {
      const result = await service.createBranch(
        'rli-use2',
        'feature/test-branch',
        'master'
      );
      expect(result).toBeDefined();
      expect(result.ref).toContain('feature/test-branch');
    });

    it('should create mock pull request', async () => {
      const pr = await service.createPullRequest(
        'rli-use2',
        'Test PR',
        'feature/test',
        'master',
        'Test body'
      );
      expect(pr).toBeDefined();
      expect(pr.title).toBe('Test PR');
      expect(pr.state).toBe('open');
    });
  });

  describe('Branch Comparison', () => {
    it('should compare branches and return mock diff', async () => {
      const comparison = await service.compareBranches(
        'rli-use2',
        'master',
        'feature/test'
      );
      expect(comparison).toBeDefined();
      expect(comparison.status).toBeDefined();
      expect(comparison.files).toBeDefined();
    });
  });
});
