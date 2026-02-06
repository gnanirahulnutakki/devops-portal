import { prisma } from '@/lib/prisma';
import { ArgoCDService, ArgoCDApplication, ArgoCDSyncResult, ArgoCDApplicationResource, ArgoCDHistory } from '@/lib/integrations/argocd';

interface ArgoCreds {
  baseUrl: string;
  token: string;
}

async function getArgoCreds(organizationId: string): Promise<ArgoCreds> {
  const envUrl = process.env.ARGOCD_URL;
  const envToken = process.env.ARGOCD_TOKEN;
  if (!envUrl || !envToken) {
    throw new Error('ArgoCD is not configured. Set ARGOCD_URL and ARGOCD_TOKEN.');
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as any) || {};
  const baseUrl = (settings.argocdUrl as string) || envUrl;
  const token = (settings.argocdToken as string) || envToken;
  return { baseUrl: baseUrl.replace(/\/$/, ''), token };
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

export async function syncApplication(orgId: string, name: string, options: { revision?: string; prune?: boolean; dryRun?: boolean }): Promise<ArgoCDSyncResult> {
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

