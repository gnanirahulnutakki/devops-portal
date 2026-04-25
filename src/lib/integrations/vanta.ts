import { logger } from '@/lib/logger';

export interface VantaVulnerability {
  id: string;
  name?: string;
  description?: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  isFixable?: boolean;
  packageIdentifier?: string;
  firstDetectedDate?: string;
  remediateByDate?: string;
  externalURL?: string;
  integrationId?: string;
}

export interface VantaPageInfo {
  endCursor?: string;
  hasNextPage?: boolean;
  startCursor?: string;
}

export interface VantaListResponse<T> {
  results?: {
    pageInfo?: VantaPageInfo;
    data?: T[];
  };
}

export class VantaService {
  private baseUrl: string;
  private accessToken: string;

  constructor(params: { accessToken: string; baseUrl?: string }) {
    this.accessToken = params.accessToken;
    this.baseUrl = params.baseUrl || 'https://api.vanta.com';
  }

  private async get<T>(path: string, query: Record<string, string | undefined> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Vanta API error (${res.status}): ${text || res.statusText}`);
    }
    return (await res.json()) as T;
  }

  async listVulnerabilities(options: {
    pageSize?: number;
    pageCursor?: string;
    severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    slaDeadlineAfterDate?: string;
    slaDeadlineBeforeDate?: string;
    isFixAvailable?: boolean;
    includeVulnerabilitiesWithoutSlas?: boolean;
  } = {}) {
    try {
      const data = await this.get<VantaListResponse<VantaVulnerability>>('/v1/vulnerabilities', {
        pageSize: options.pageSize ? String(options.pageSize) : undefined,
        pageCursor: options.pageCursor,
        severity: options.severity,
        slaDeadlineAfterDate: options.slaDeadlineAfterDate,
        slaDeadlineBeforeDate: options.slaDeadlineBeforeDate,
        isFixAvailable: options.isFixAvailable !== undefined ? String(options.isFixAvailable) : undefined,
        includeVulnerabilitiesWithoutSlas:
          options.includeVulnerabilitiesWithoutSlas !== undefined
            ? String(options.includeVulnerabilitiesWithoutSlas)
            : undefined,
      });
      return data;
    } catch (error) {
      logger.warn({ error: (error as Error).message }, 'Failed to list Vanta vulnerabilities');
      throw error;
    }
  }
}

