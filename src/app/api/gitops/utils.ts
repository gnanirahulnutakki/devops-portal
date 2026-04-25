import { githubTokens } from '@/lib/token-store';
import { createGitHubClient } from '@/lib/http-client';
import { prisma } from '@/lib/prisma';
import { getCredentials, GitHubCredentials } from '@/lib/services/integration-credentials';

export async function getGitHubTokenForUser(userId: string, organizationId?: string): Promise<string | null> {
  const userToken = await githubTokens.get(userId);
  if (userToken?.accessToken) return userToken.accessToken;
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const settings = (org?.settings as any) || {};
    const credentialId = settings?.github?.credentialId as string | undefined;
    const orgCreds = await getCredentials<GitHubCredentials>(organizationId, 'GITHUB', {
      credentialId,
    });
    if (orgCreds?.token) return orgCreds.token;
  }
  return process.env.GITHUB_TOKEN || null;
}

export async function getDefaultBranchForRepo(token: string, repo: string): Promise<string | null> {
  try {
    const client = createGitHubClient(token);
    const response = await client.get(`repos/${repo}`);
    const data = await response.json<{ default_branch?: string }>();
    return data.default_branch || null;
  } catch {
    return null;
  }
}
