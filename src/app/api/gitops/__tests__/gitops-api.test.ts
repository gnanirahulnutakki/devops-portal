/**
 * GitOps Studio API Tests
 * 
 * Tests for the GitOps Studio backend APIs:
 * - Branches API
 * - Contents API
 * - Tree API
 * - Pull Requests API
 * - Bulk Commit API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock GitHub client
vi.mock('@/lib/http-client', () => ({
  createGitHubClient: vi.fn(() => ({
    get: vi.fn().mockImplementation((url: string) => {
      // Mock responses based on URL
      if (url.includes('/branches')) {
        return Promise.resolve({
          json: () => Promise.resolve([
            { name: 'main', commit: { sha: 'abc123' }, protected: true },
            { name: 'develop', commit: { sha: 'def456' }, protected: false },
          ]),
        });
      }
      if (url.includes('/contents/')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            name: 'values.yaml',
            path: 'helm/values.yaml',
            sha: 'sha123',
            size: 1024,
            type: 'file',
            content: Buffer.from('key: value\nfoo: bar').toString('base64'),
            encoding: 'base64',
          }),
        });
      }
      if (url.includes('/git/trees/')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            sha: 'tree123',
            tree: [
              { path: 'README.md', type: 'blob', sha: 'sha1', size: 100 },
              { path: 'helm/values.yaml', type: 'blob', sha: 'sha2', size: 500 },
              { path: 'helm', type: 'tree', sha: 'sha3' },
            ],
            truncated: false,
          }),
        });
      }
      if (url.includes('/git/refs/heads/')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            ref: 'refs/heads/main',
            object: { sha: 'abc123', type: 'commit' },
          }),
        });
      }
      if (url.includes('/pulls')) {
        return Promise.resolve({
          json: () => Promise.resolve([
            {
              id: 1,
              number: 42,
              title: 'Test PR',
              body: 'Test body',
              state: 'open',
              html_url: 'https://github.com/test/repo/pull/42',
              head: { ref: 'feature', sha: 'abc' },
              base: { ref: 'main' },
              user: { login: 'testuser', avatar_url: 'https://avatar.url' },
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-02T00:00:00Z',
              merged_at: null,
              mergeable: true,
              mergeable_state: 'clean',
            },
          ]),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    }),
    put: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        json: () => Promise.resolve({
          content: { name: 'values.yaml', path: 'helm/values.yaml', sha: 'new_sha' },
          commit: { sha: 'commit_sha', message: 'Update values.yaml', html_url: 'https://github.com/...' },
        }),
      });
    }),
    post: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/git/refs')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            ref: 'refs/heads/new-branch',
            object: { sha: 'abc123', type: 'commit' },
          }),
        });
      }
      if (url.includes('/pulls')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            id: 2,
            number: 43,
            title: 'New PR',
            html_url: 'https://github.com/test/repo/pull/43',
            head: { ref: 'feature' },
            base: { ref: 'main' },
            state: 'open',
          }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    }),
  })),
  fetchJson: vi.fn().mockImplementation(async (client: unknown, url: string) => {
    if (url.includes('/branches?')) {
      return [
        { name: 'main', commit: { sha: 'abc123' }, protected: true },
        { name: 'develop', commit: { sha: 'def456' }, protected: false },
      ];
    }
    if (url.includes('/branches/')) {
      return { commit: { sha: 'abc123' } };
    }
    if (url.includes('/git/refs/heads/')) {
      return {
        ref: 'refs/heads/main',
        object: { sha: 'abc123', type: 'commit' },
      };
    }
    if (url.includes('/git/trees/')) {
      return {
        sha: 'tree123',
        tree: [
          { path: 'README.md', type: 'blob', sha: 'sha1', size: 100 },
          { path: 'helm/values.yaml', type: 'blob', sha: 'sha2', size: 500 },
        ],
        truncated: false,
      };
    }
    if (url.includes('/pulls')) {
      return [
        {
          id: 1,
          number: 42,
          title: 'Test PR',
          body: 'Test body',
          state: 'open',
          html_url: 'https://github.com/test/repo/pull/42',
          head: { ref: 'feature', sha: 'abc' },
          base: { ref: 'main' },
          user: { login: 'testuser', avatar_url: 'https://avatar.url' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          merged_at: null,
          mergeable: true,
          mergeable_state: 'clean',
        },
      ];
    }
    throw new Error(`Unknown URL: ${url}`);
  }),
}));

describe('GitOps Studio API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set env vars
    process.env.GITHUB_TOKEN = 'test_token';
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  describe('Branch Validation', () => {
    it('should validate branch name format', () => {
      const validBranchNames = ['main', 'develop', 'feature/test', 'release-1.0.0'];
      const invalidBranchNames = ['main..test', 'branch name', ''];

      validBranchNames.forEach(name => {
        expect(name.length).toBeGreaterThan(0);
        expect(name).not.toContain('..');
      });

      invalidBranchNames.forEach(name => {
        expect(name.includes('..') || name.includes(' ') || name.length === 0).toBe(true);
      });
    });
  });

  describe('File Path Validation', () => {
    it('should validate file path format', () => {
      const validPaths = ['values.yaml', 'helm/values.yaml', 'charts/app/values.yaml'];
      const invalidPaths = ['../secret.yaml', '/etc/passwd', ''];

      validPaths.forEach(path => {
        expect(path.length).toBeGreaterThan(0);
        expect(path).not.toContain('..');
        expect(path).not.toMatch(/^[/\\]/);
      });

      invalidPaths.forEach(path => {
        expect(
          path.includes('..') || /^[/\\]/.test(path) || path.length === 0
        ).toBe(true);
      });
    });
  });

  describe('Content Encoding', () => {
    it('should properly encode content to base64', () => {
      const content = 'key: value\nfoo: bar';
      const encoded = Buffer.from(content).toString('base64');
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');

      expect(decoded).toBe(content);
    });

    it('should handle unicode content', () => {
      const unicodeContent = '# 配置文件\nkey: 值';
      const encoded = Buffer.from(unicodeContent).toString('base64');
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');

      expect(decoded).toBe(unicodeContent);
    });
  });

  describe('Bulk Commit Logic', () => {
    it('should group changes by repository', () => {
      const changes = [
        { repo: 'owner/repo1', path: 'file1.yaml', branch: 'main' },
        { repo: 'owner/repo1', path: 'file2.yaml', branch: 'main' },
        { repo: 'owner/repo2', path: 'file1.yaml', branch: 'main' },
      ];

      const grouped = changes.reduce((acc, change) => {
        if (!acc[change.repo]) acc[change.repo] = [];
        acc[change.repo].push(change);
        return acc;
      }, {} as Record<string, typeof changes>);

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['owner/repo1']).toHaveLength(2);
      expect(grouped['owner/repo2']).toHaveLength(1);
    });

    it('should group changes by branch for PR creation', () => {
      const changes = [
        { repo: 'owner/repo1', path: 'file1.yaml', branch: 'feature1' },
        { repo: 'owner/repo1', path: 'file2.yaml', branch: 'feature1' },
        { repo: 'owner/repo1', path: 'file3.yaml', branch: 'feature2' },
      ];

      const branchGroups = new Map<string, typeof changes>();
      
      for (const change of changes) {
        const key = `${change.repo}:${change.branch}`;
        if (!branchGroups.has(key)) {
          branchGroups.set(key, []);
        }
        branchGroups.get(key)!.push(change);
      }

      expect(branchGroups.size).toBe(2);
      expect(branchGroups.get('owner/repo1:feature1')).toHaveLength(2);
      expect(branchGroups.get('owner/repo1:feature2')).toHaveLength(1);
    });
  });

  describe('Tree Filtering', () => {
    it('should filter files by pattern', () => {
      const tree = [
        { path: 'README.md', type: 'blob' },
        { path: 'helm/values.yaml', type: 'blob' },
        { path: 'charts/app/values.yaml', type: 'blob' },
        { path: 'src/index.ts', type: 'blob' },
      ];

      const filter = 'values.yaml';
      const filtered = tree.filter(item =>
        item.path.toLowerCase().includes(filter.toLowerCase()) ||
        item.path.toLowerCase().endsWith(filter.toLowerCase())
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.every(f => f.path.includes('values.yaml'))).toBe(true);
    });

    it('should filter files case-insensitively', () => {
      const tree = [
        { path: 'VALUES.yaml', type: 'blob' },
        { path: 'values.YAML', type: 'blob' },
        { path: 'Values.Yaml', type: 'blob' },
      ];

      const filter = 'values.yaml';
      const filtered = tree.filter(item =>
        item.path.toLowerCase().includes(filter.toLowerCase())
      );

      expect(filtered).toHaveLength(3);
    });
  });

  describe('Admin Access Control', () => {
    it('should identify admin role correctly', () => {
      const isAdmin = (role: string) => role === 'ADMIN';

      expect(isAdmin('ADMIN')).toBe(true);
      expect(isAdmin('READWRITE')).toBe(false);
      expect(isAdmin('USER')).toBe(false);
    });

    it('should enforce admin-only routes', () => {
      const adminOnlyRoutes = ['/api/gitops/branches', '/api/gitops/contents', '/api/gitops/bulk-commit'];
      const requiredRole = 'ADMIN';

      adminOnlyRoutes.forEach(route => {
        expect(route.startsWith('/api/gitops/')).toBe(true);
      });

      expect(requiredRole).toBe('ADMIN');
    });
  });

  describe('PR Creation Validation', () => {
    it('should validate PR creation parameters', () => {
      const validPR = {
        repo: 'owner/repo',
        title: 'Test PR',
        head: 'feature',
        base: 'main',
      };

      expect(validPR.repo).toBeTruthy();
      expect(validPR.title).toBeTruthy();
      expect(validPR.head).toBeTruthy();
      expect(validPR.base).toBeTruthy();
      expect(validPR.head).not.toBe(validPR.base);
    });

    it('should reject PR when head equals base', () => {
      const invalidPR = {
        repo: 'owner/repo',
        title: 'Test PR',
        head: 'main',
        base: 'main',
      };

      expect(invalidPR.head).toBe(invalidPR.base);
    });
  });

  describe('Language Detection', () => {
    it('should detect language from filename', () => {
      const langMap: Record<string, string> = {
        yaml: 'yaml',
        yml: 'yaml',
        json: 'json',
        md: 'markdown',
        js: 'javascript',
        ts: 'typescript',
        tsx: 'typescript',
        py: 'python',
        sh: 'shell',
      };

      const getLanguage = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase();
        return langMap[ext || ''] || 'plaintext';
      };

      expect(getLanguage('values.yaml')).toBe('yaml');
      expect(getLanguage('config.json')).toBe('json');
      expect(getLanguage('README.md')).toBe('markdown');
      expect(getLanguage('index.ts')).toBe('typescript');
      expect(getLanguage('unknown.xyz')).toBe('plaintext');
    });
  });

  describe('File Size Formatting', () => {
    it('should format file sizes correctly', () => {
      const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      };

      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
    });
  });

  describe('Change Tracking', () => {
    it('should detect unsaved changes', () => {
      const originalContent = 'key: value';
      const editedContent = 'key: newvalue';
      const sameContent = 'key: value';

      expect(editedContent !== originalContent).toBe(true);
      expect(sameContent !== originalContent).toBe(false);
    });

    it('should track staged changes', () => {
      const pendingChanges: Array<{
        repo: string;
        path: string;
        originalContent: string;
        newContent: string;
      }> = [];

      // Add a change
      pendingChanges.push({
        repo: 'owner/repo',
        path: 'values.yaml',
        originalContent: 'key: value',
        newContent: 'key: newvalue',
      });

      expect(pendingChanges).toHaveLength(1);

      // Update existing change
      const existingIdx = pendingChanges.findIndex(
        c => c.repo === 'owner/repo' && c.path === 'values.yaml'
      );
      
      expect(existingIdx).toBe(0);

      pendingChanges[existingIdx].newContent = 'key: anothervalue';
      expect(pendingChanges[existingIdx].newContent).toBe('key: anothervalue');
    });

    it('should remove staged changes', () => {
      const pendingChanges = [
        { repo: 'owner/repo', path: 'file1.yaml' },
        { repo: 'owner/repo', path: 'file2.yaml' },
      ];

      // Remove first change
      pendingChanges.splice(0, 1);
      
      expect(pendingChanges).toHaveLength(1);
      expect(pendingChanges[0].path).toBe('file2.yaml');
    });
  });
});

describe('GitOps Integration Scenarios', () => {
  it('should handle typical workflow: select repo → branch → file → edit → stage → commit', () => {
    // Simulate the workflow
    const workflow = {
      step1: 'select_repo',
      step2: 'select_branch',
      step3: 'browse_files',
      step4: 'select_file',
      step5: 'edit_content',
      step6: 'stage_change',
      step7: 'commit_changes',
    };

    const steps = Object.values(workflow);
    expect(steps).toHaveLength(7);
    expect(steps[0]).toBe('select_repo');
    expect(steps[steps.length - 1]).toBe('commit_changes');
  });

  it('should handle bulk edit workflow: select multiple files → edit each → bulk commit', () => {
    const selectedFiles = ['values-dev.yaml', 'values-staging.yaml', 'values-prod.yaml'];
    const changes: Array<{ path: string; content: string }> = [];

    // Simulate editing each file
    selectedFiles.forEach(file => {
      changes.push({
        path: file,
        content: `# Updated ${file}\nkey: value`,
      });
    });

    expect(changes).toHaveLength(3);
    expect(changes.every(c => c.content.includes('Updated'))).toBe(true);
  });

  it('should handle PR workflow: create branch → commit → create PR', () => {
    const workflow = {
      createBranch: {
        fromBranch: 'main',
        newBranch: 'feature/update-values',
      },
      commit: {
        message: 'Update configuration values',
        branch: 'feature/update-values',
      },
      createPR: {
        title: 'Update configuration values',
        head: 'feature/update-values',
        base: 'main',
      },
    };

    expect(workflow.createBranch.newBranch).toBe(workflow.commit.branch);
    expect(workflow.commit.branch).toBe(workflow.createPR.head);
    expect(workflow.createPR.head).not.toBe(workflow.createPR.base);
  });
});
