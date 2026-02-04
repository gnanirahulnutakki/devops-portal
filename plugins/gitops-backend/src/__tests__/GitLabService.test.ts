import { GitLabService } from '../services/GitLabService';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GitLabService', () => {
  let service: GitLabService;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      defaults: { headers: { common: {} } },
    };
    mockedAxios.create.mockReturnValue(mockClient as any);

    service = new GitLabService({
      baseUrl: 'https://gitlab.example.com',
      token: 'test-token',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default gitlab.com URL', () => {
      const defaultService = new GitLabService({ token: 'token' });
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://gitlab.com/api/v4',
        })
      );
    });

    it('should initialize with custom URL', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://gitlab.example.com/api/v4',
        })
      );
    });
  });

  describe('listProjects', () => {
    it('should list projects with default options', async () => {
      const mockProjects = [
        { id: 1, name: 'project1', path_with_namespace: 'org/project1' },
        { id: 2, name: 'project2', path_with_namespace: 'org/project2' },
      ];
      mockClient.get.mockResolvedValue({ data: mockProjects });

      const result = await service.listProjects();

      expect(mockClient.get).toHaveBeenCalledWith('/projects', {
        params: expect.objectContaining({
          per_page: 20,
          page: 1,
          membership: true,
        }),
      });
      expect(result).toEqual(mockProjects);
    });

    it('should list projects with search filter', async () => {
      mockClient.get.mockResolvedValue({ data: [] });

      await service.listProjects({ search: 'test' });

      expect(mockClient.get).toHaveBeenCalledWith('/projects', {
        params: expect.objectContaining({
          search: 'test',
        }),
      });
    });

    it('should list projects with pagination', async () => {
      mockClient.get.mockResolvedValue({ data: [] });

      await service.listProjects({ page: 2, perPage: 50 });

      expect(mockClient.get).toHaveBeenCalledWith('/projects', {
        params: expect.objectContaining({
          page: 2,
          per_page: 50,
        }),
      });
    });
  });

  describe('getProject', () => {
    it('should get project by ID', async () => {
      const mockProject = { id: 1, name: 'project1' };
      mockClient.get.mockResolvedValue({ data: mockProject });

      const result = await service.getProject(1);

      expect(mockClient.get).toHaveBeenCalledWith('/projects/1');
      expect(result).toEqual(mockProject);
    });

    it('should get project by path (URL encoded)', async () => {
      const mockProject = { id: 1, name: 'project1' };
      mockClient.get.mockResolvedValue({ data: mockProject });

      const result = await service.getProject('org/project1');

      expect(mockClient.get).toHaveBeenCalledWith('/projects/org%2Fproject1');
      expect(result).toEqual(mockProject);
    });
  });

  describe('listBranches', () => {
    it('should list branches for a project', async () => {
      const mockBranches = [
        { name: 'main', protected: true },
        { name: 'develop', protected: false },
      ];
      mockClient.get.mockResolvedValue({ data: mockBranches });

      const result = await service.listBranches(1);

      expect(mockClient.get).toHaveBeenCalledWith('/projects/1/repository/branches');
      expect(result).toEqual(mockBranches);
    });
  });

  describe('getTree', () => {
    it('should get repository tree', async () => {
      const mockTree = [
        { name: 'file.txt', type: 'blob', path: 'file.txt' },
        { name: 'folder', type: 'tree', path: 'folder' },
      ];
      mockClient.get.mockResolvedValue({ data: mockTree });

      const result = await service.getTree(1);

      expect(mockClient.get).toHaveBeenCalledWith('/projects/1/repository/tree', {
        params: {},
      });
      expect(result).toEqual(mockTree);
    });

    it('should get tree with options', async () => {
      mockClient.get.mockResolvedValue({ data: [] });

      await service.getTree(1, { ref: 'main', path: 'src', recursive: true });

      expect(mockClient.get).toHaveBeenCalledWith('/projects/1/repository/tree', {
        params: { ref: 'main', path: 'src', recursive: true },
      });
    });
  });

  describe('getFile', () => {
    it('should get file content', async () => {
      const mockFile = {
        file_name: 'test.txt',
        content: 'SGVsbG8gV29ybGQ=', // Base64 "Hello World"
        encoding: 'base64',
      };
      mockClient.get.mockResolvedValue({ data: mockFile });

      const result = await service.getFile(1, 'test.txt');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/projects/1/repository/files/test.txt',
        { params: {} }
      );
      expect(result).toEqual(mockFile);
    });

    it('should get file content for specific ref', async () => {
      mockClient.get.mockResolvedValue({ data: {} });

      await service.getFile(1, 'test.txt', 'develop');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/projects/1/repository/files/test.txt',
        { params: { ref: 'develop' } }
      );
    });
  });

  describe('updateFile', () => {
    it('should update existing file', async () => {
      // First call checks if file exists
      mockClient.get.mockResolvedValueOnce({ data: { file_name: 'test.txt' } });
      // Second call updates the file
      mockClient.put.mockResolvedValue({ data: { id: 'commit-sha' } });

      const result = await service.updateFile(1, 'test.txt', 'new content', {
        branch: 'main',
        commitMessage: 'Update file',
      });

      expect(mockClient.put).toHaveBeenCalledWith(
        '/projects/1/repository/files/test.txt',
        expect.objectContaining({
          branch: 'main',
          content: 'new content',
          commit_message: 'Update file',
        })
      );
    });

    it('should create new file if not exists', async () => {
      // First call fails (file doesn't exist)
      mockClient.get.mockRejectedValueOnce(new Error('Not found'));
      // Second call creates the file
      mockClient.post.mockResolvedValue({ data: { id: 'commit-sha' } });

      await service.updateFile(1, 'new-file.txt', 'content', {
        branch: 'main',
        commitMessage: 'Create file',
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/projects/1/repository/files/new-file.txt',
        expect.objectContaining({
          branch: 'main',
          content: 'content',
          commit_message: 'Create file',
        })
      );
    });
  });

  describe('listMergeRequests', () => {
    it('should list merge requests', async () => {
      const mockMRs = [
        { iid: 1, title: 'MR 1', state: 'opened' },
        { iid: 2, title: 'MR 2', state: 'merged' },
      ];
      mockClient.get.mockResolvedValue({ data: mockMRs });

      const result = await service.listMergeRequests(1);

      expect(mockClient.get).toHaveBeenCalledWith('/projects/1/merge_requests', {
        params: { per_page: 20 },
      });
      expect(result).toEqual(mockMRs);
    });

    it('should filter merge requests by state', async () => {
      mockClient.get.mockResolvedValue({ data: [] });

      await service.listMergeRequests(1, { state: 'opened' });

      expect(mockClient.get).toHaveBeenCalledWith('/projects/1/merge_requests', {
        params: { per_page: 20, state: 'opened' },
      });
    });
  });

  describe('createMergeRequest', () => {
    it('should create a merge request', async () => {
      const mockMR = { iid: 1, title: 'New MR' };
      mockClient.post.mockResolvedValue({ data: mockMR });

      const result = await service.createMergeRequest(1, {
        sourceBranch: 'feature',
        targetBranch: 'main',
        title: 'New MR',
        description: 'Description',
      });

      expect(mockClient.post).toHaveBeenCalledWith('/projects/1/merge_requests', {
        source_branch: 'feature',
        target_branch: 'main',
        title: 'New MR',
        description: 'Description',
        remove_source_branch: true,
      });
      expect(result).toEqual(mockMR);
    });
  });

  describe('listPipelines', () => {
    it('should list pipelines', async () => {
      const mockPipelines = [
        { id: 1, status: 'success', ref: 'main' },
        { id: 2, status: 'running', ref: 'develop' },
      ];
      mockClient.get.mockResolvedValue({ data: mockPipelines });

      const result = await service.listPipelines(1);

      expect(mockClient.get).toHaveBeenCalledWith('/projects/1/pipelines', {
        params: { per_page: 20 },
      });
      expect(result).toEqual(mockPipelines);
    });

    it('should filter pipelines by ref and status', async () => {
      mockClient.get.mockResolvedValue({ data: [] });

      await service.listPipelines(1, { ref: 'main', status: 'success' });

      expect(mockClient.get).toHaveBeenCalledWith('/projects/1/pipelines', {
        params: { per_page: 20, ref: 'main', status: 'success' },
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when GitLab is accessible', async () => {
      mockClient.get.mockResolvedValue({
        data: { id: 1, username: 'test' },
      });

      const result = await service.healthCheck();

      expect(result).toEqual({
        healthy: true,
        message: 'GitLab connection OK',
      });
    });

    it('should return unhealthy when GitLab is not accessible', async () => {
      mockClient.get.mockRejectedValue(new Error('Connection refused'));

      const result = await service.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'GitLab connection failed: Connection refused',
      });
    });
  });

  describe('withToken', () => {
    it('should create new instance with different token', () => {
      const newService = service.withToken('new-token');
      
      expect(newService).toBeInstanceOf(GitLabService);
      expect(newService).not.toBe(service);
    });
  });
});
