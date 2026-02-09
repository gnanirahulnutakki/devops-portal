import { prisma } from '@/lib/prisma';
import { ArgoCDService, ArgoCDApplication, ArgoCDSyncResult, ArgoCDApplicationResource, ArgoCDHistory } from '@/lib/integrations/argocd';
import { createArgoCDClient } from '@/lib/http-client';
import { getArgoCDCredentials } from './integration-credentials';
import { KyInstance } from 'ky';

interface ArgoCreds {
  baseUrl: string;
  token: string;
}

async function getArgoCreds(organizationId: string): Promise<ArgoCreds> {
  // 1. Try encrypted IntegrationCredential DB + env fallback (preferred path)
  const creds = await getArgoCDCredentials(organizationId);
  if (creds) {
    return { baseUrl: creds.url.replace(/\/$/, ''), token: creds.token };
  }

  // 2. Legacy fallback: plaintext org.settings (deprecated, for backward compat)
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as any) || {};
  if (settings.argocdUrl && settings.argocdToken) {
    return {
      baseUrl: (settings.argocdUrl as string).replace(/\/$/, ''),
      token: settings.argocdToken as string,
    };
  }

  throw new Error('ArgoCD is not configured. Add credentials in Settings or set ARGOCD_URL and ARGOCD_TOKEN.');
}

export async function getArgoBaseUrl(organizationId: string): Promise<string> {
  const { baseUrl } = await getArgoCreds(organizationId);
  return baseUrl;
}

/**
 * Get the ArgoCD HTTP client for making direct API calls
 */
export async function getArgoCDClient(organizationId: string): Promise<KyInstance> {
  const { baseUrl, token } = await getArgoCreds(organizationId);
  return createArgoCDClient(baseUrl, token);
}

export async function getArgoService(orgId: string): Promise<ArgoCDService> {
  const { baseUrl, token } = await getArgoCreds(orgId);
  return new ArgoCDService(baseUrl, token);
}

// Convenience wrappers
export async function listApplications(orgId: string, project?: string): Promise<ArgoCDApplication[]> {
  const svc = await getArgoService(orgId);
  return svc.listApplications(project);
}

export async function syncApplication(
  orgId: string,
  name: string,
  options: { revision?: string; prune?: boolean; dryRun?: boolean }
): Promise<ArgoCDSyncResult> {
  const svc = await getArgoService(orgId);
  return svc.syncApplication(name, options);
}

export async function getApplicationResources(orgId: string, name: string): Promise<ArgoCDApplicationResource[]> {
  const svc = await getArgoService(orgId);
  return svc.getApplicationResources(name);
}

export async function getApplicationHistory(orgId: string, name: string): Promise<ArgoCDHistory[]> {
  const svc = await getArgoService(orgId);
  return svc.getApplicationHistory(name);
}

/**
 * Get detailed information about a single application
 */
export async function getApplication(orgId: string, name: string): Promise<ArgoCDApplication & { resources?: ArgoCDApplicationResource[] }> {
  const svc = await getArgoService(orgId);
  return svc.getApplication(name);
}
