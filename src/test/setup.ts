// =============================================================================
// Test Setup - Global test configuration
// =============================================================================
// No-mock policy: this project does not mock its own modules in tests. Tests
// run against the real logger, real crypto, and (where the test needs them)
// real Postgres/Redis on localhost via the docker-compose stack.

// @ts-expect-error - NODE_ENV assignment for test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/devops_portal?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? 'test-secret-key-at-least-32-characters';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
process.env.TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ?? 'test-encryption-key-32-chars!!!';

// Silence the real pino logger instead of mocking it. Pino treats 'silent'
// as a valid level that drops all log records before any I/O.
// Must be set before any module imports `@/lib/logger`, hence: setupFiles.
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

// Global test utilities
export const mockOrganizationId = 'org-test-123';
export const mockUserId = 'user-test-456';
export const mockRequestId = 'req-test-789';

export function createMockTenantContext(overrides = {}) {
  return {
    organizationId: mockOrganizationId,
    organizationSlug: 'test-org',
    userId: mockUserId,
    userRole: 'ADMIN' as const,
    requestId: mockRequestId,
    timestamp: Date.now(),
    ...overrides,
  };
}

export function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
} = {}) {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/test',
    headers = {},
    body,
  } = options;

  return new Request(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
