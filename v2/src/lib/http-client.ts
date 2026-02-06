import ky, { type KyInstance, type Options } from 'ky';
import { logger } from './logger';

// =============================================================================
// HTTP Client Configuration
// =============================================================================

export interface HttpClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export function createHttpClient(config: HttpClientConfig): KyInstance {
  return ky.create({
    prefixUrl: config.baseUrl,
    timeout: config.timeout || 30000,
    retry: {
      limit: config.retries || 2,
      methods: ['get', 'put', 'head', 'delete', 'options', 'trace'],
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
      backoffLimit: 3000,
    },
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
    hooks: {
      beforeRequest: [
        (request) => {
          // Add trace ID for correlation
          const traceId = crypto.randomUUID();
          request.headers.set('X-Trace-ID', traceId);
          
          logger.debug({
            method: request.method,
            url: request.url,
            traceId,
          }, 'HTTP request');
        },
      ],
      afterResponse: [
        (request, options, response) => {
          const traceId = request.headers.get('X-Trace-ID');
          logger.debug({
            method: request.method,
            url: request.url,
            status: response.status,
            traceId,
          }, 'HTTP response');
          
          return response;
        },
      ],
      beforeError: [
        (error) => {
          const { request, response } = error;
          const traceId = request?.headers.get('X-Trace-ID');
          
          logger.error({
            method: request?.method,
            url: request?.url,
            status: response?.status,
            traceId,
            error: error.message,
          }, 'HTTP error');
          
          return error;
        },
      ],
    },
  });
}

// =============================================================================
// Pre-configured Clients
// =============================================================================

// GitHub API client
export function createGitHubClient(token: string): KyInstance {
  return createHttpClient({
    baseUrl: 'https://api.github.com',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
}

// ArgoCD API client
export function createArgoCDClient(baseUrl: string, token: string): KyInstance {
  return createHttpClient({
    baseUrl,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// Grafana API client
export function createGrafanaClient(baseUrl: string, apiKey: string): KyInstance {
  const url = baseUrl.replace(/\/$/, '');
  return createHttpClient({
    baseUrl: url,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

// Prometheus API client
export function createPrometheusClient(baseUrl: string): KyInstance {
  return createHttpClient({
    baseUrl,
    timeout: 60000, // Longer timeout for metric queries
  });
}

// =============================================================================
// Generic Request Helpers
// =============================================================================

export async function fetchJson<T>(
  client: KyInstance,
  path: string,
  options?: Options
): Promise<T> {
  const response = await client.get(path, options);
  return response.json<T>();
}

export async function postJson<T, R = unknown>(
  client: KyInstance,
  path: string,
  data: T,
  options?: Options
): Promise<R> {
  const response = await client.post(path, {
    ...options,
    json: data,
  });
  return response.json<R>();
}

export async function putJson<T, R = unknown>(
  client: KyInstance,
  path: string,
  data: T,
  options?: Options
): Promise<R> {
  const response = await client.put(path, {
    ...options,
    json: data,
  });
  return response.json<R>();
}

export async function deleteRequest<R = void>(
  client: KyInstance,
  path: string,
  options?: Options
): Promise<R> {
  const response = await client.delete(path, options);
  if (response.status === 204) {
    return undefined as R;
  }
  return response.json<R>();
}
