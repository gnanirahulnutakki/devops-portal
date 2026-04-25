// =============================================================================
// Test Setup - Global test configuration and mocks
// =============================================================================

import { vi, beforeEach, afterEach } from 'vitest';

// Mock environment variables
// @ts-expect-error - NODE_ENV assignment for test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.NEXTAUTH_SECRET = 'test-secret-key-at-least-32-characters';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32-chars!!!';

// Mock logger globally
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

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
