import { AuthTokenService } from '../services/AuthTokenService';
import { Request } from 'express';

// Mock fetch
global.fetch = jest.fn();

describe('AuthTokenService', () => {
  let service: AuthTokenService;

  beforeEach(() => {
    service = new AuthTokenService({
      fallbackGitHubToken: 'fallback-github-token',
      fallbackGitLabToken: 'fallback-gitlab-token',
      allowUnauthenticated: true,
    });
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(service).toBeInstanceOf(AuthTokenService);
    });
  });

  describe('getUserFromRequest', () => {
    it('should return null when no user in request', async () => {
      const req = {} as Request;
      const result = await service.getUserFromRequest(req);
      expect(result).toBeNull();
    });

    it('should extract user from Backstage format', async () => {
      const req = {
        user: {
          identity: {
            userEntityRef: 'user:default/testuser',
            email: 'test@example.com',
            displayName: 'Test User',
            provider: 'github',
          },
        },
        headers: {},
        session: {},
        credentials: {},
      } as unknown as Request;

      const result = await service.getUserFromRequest(req);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user:default/testuser');
      expect(result?.email).toBe('test@example.com');
      expect(result?.displayName).toBe('Test User');
      expect(result?.provider).toBe('github');
    });

    it('should extract user without identity wrapper', async () => {
      const req = {
        user: {
          sub: 'user123',
          email: 'test@example.com',
          name: 'Test User',
        },
        headers: {},
        session: {},
      } as unknown as Request;

      const result = await service.getUserFromRequest(req);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user123');
    });
  });

  describe('getGitHubToken', () => {
    it('should return user OAuth token when available', async () => {
      const req = {
        user: {
          identity: {
            userEntityRef: 'user:default/testuser',
            provider: 'github',
          },
        },
        headers: {
          'x-github-token': 'user-oauth-token',
        },
        session: {},
        credentials: {},
      } as unknown as Request;

      const token = await service.getGitHubToken(req);

      expect(token).toBe('user-oauth-token');
    });

    it('should return fallback token when user not authenticated', async () => {
      const req = {
        headers: {},
        session: {},
      } as unknown as Request;

      const token = await service.getGitHubToken(req);

      expect(token).toBe('fallback-github-token');
    });

    it('should return null when unauthenticated not allowed and no user', async () => {
      const strictService = new AuthTokenService({
        fallbackGitHubToken: 'fallback',
        allowUnauthenticated: false,
      });

      const req = {
        headers: {},
        session: {},
      } as unknown as Request;

      const token = await strictService.getGitHubToken(req);

      expect(token).toBeNull();
    });

    it('should extract token from authorization header', async () => {
      const req = {
        user: {
          identity: {
            userEntityRef: 'user:default/testuser',
          },
        },
        headers: {
          authorization: 'Bearer github:oauth-token-from-header',
        },
        session: {},
      } as unknown as Request;

      const token = await service.getGitHubToken(req);

      expect(token).toBe('oauth-token-from-header');
    });

    it('should extract token from session', async () => {
      const req = {
        user: {
          identity: {
            userEntityRef: 'user:default/testuser',
          },
        },
        headers: {},
        session: {
          passport: {
            user: {
              accessToken: 'session-oauth-token',
            },
          },
        },
      } as unknown as Request;

      const token = await service.getGitHubToken(req);

      expect(token).toBe('session-oauth-token');
    });
  });

  describe('getGitLabToken', () => {
    it('should return user OAuth token when available', async () => {
      const req = {
        user: {
          identity: {
            userEntityRef: 'user:default/testuser',
          },
        },
        headers: {
          'x-gitlab-token': 'gitlab-user-token',
        },
        session: {},
      } as unknown as Request;

      const token = await service.getGitLabToken(req);

      expect(token).toBe('gitlab-user-token');
    });

    it('should return fallback token when user not authenticated', async () => {
      const req = {
        headers: {},
        session: {},
      } as unknown as Request;

      const token = await service.getGitLabToken(req);

      expect(token).toBe('fallback-gitlab-token');
    });

    it('should extract token from session', async () => {
      const req = {
        user: {
          identity: {
            userEntityRef: 'user:default/testuser',
          },
        },
        headers: {},
        session: {
          gitlabToken: 'session-gitlab-token',
        },
      } as unknown as Request;

      const token = await service.getGitLabToken(req);

      expect(token).toBe('session-gitlab-token');
    });
  });

  describe('checkPermissions', () => {
    it('should allow authenticated user', async () => {
      const req = {
        user: {
          identity: {
            userEntityRef: 'user:default/testuser',
          },
        },
        headers: {},
        session: {},
      } as unknown as Request;

      const result = await service.checkPermissions(req, ['repo']);

      expect(result.allowed).toBe(true);
    });

    it('should allow unauthenticated when config allows', async () => {
      const req = {
        headers: {},
        session: {},
      } as unknown as Request;

      const result = await service.checkPermissions(req, ['repo']);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Unauthenticated access allowed');
    });

    it('should deny unauthenticated when config does not allow', async () => {
      const strictService = new AuthTokenService({
        allowUnauthenticated: false,
      });

      const req = {
        headers: {},
        session: {},
      } as unknown as Request;

      const result = await strictService.checkPermissions(req, ['repo']);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Authentication required');
    });
  });

  describe('getUserOrganizations', () => {
    it('should return empty array when no token', async () => {
      const strictService = new AuthTokenService({
        allowUnauthenticated: false,
      });

      const req = {
        headers: {},
        session: {},
      } as unknown as Request;

      const orgs = await strictService.getUserOrganizations(req);

      expect(orgs).toEqual([]);
    });

    it('should fetch and return user organizations', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [
          { login: 'org1' },
          { login: 'org2' },
        ],
      });

      const req = {
        headers: {
          'x-github-token': 'user-token',
        },
        session: {},
        user: {
          identity: { userEntityRef: 'user:default/test' },
        },
      } as unknown as Request;

      const orgs = await service.getUserOrganizations(req);

      expect(orgs).toEqual(['org1', 'org2']);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user/orgs',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer user-token',
          }),
        })
      );
    });

    it('should return empty array on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const req = {
        headers: {
          'x-github-token': 'invalid-token',
        },
        session: {},
        user: {
          identity: { userEntityRef: 'user:default/test' },
        },
      } as unknown as Request;

      const orgs = await service.getUserOrganizations(req);

      expect(orgs).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const req = {
        headers: {
          'x-github-token': 'token',
        },
        session: {},
        user: {
          identity: { userEntityRef: 'user:default/test' },
        },
      } as unknown as Request;

      const orgs = await service.getUserOrganizations(req);

      expect(orgs).toEqual([]);
    });
  });
});
