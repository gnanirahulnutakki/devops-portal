import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';
import GitHubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';
import { githubTokens } from './token-store';
import { logger } from './logger';

// =============================================================================
// Auth Configuration
// =============================================================================

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  
  providers: [
    // Primary: Keycloak SSO
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_ID!,
      clientSecret: process.env.KEYCLOAK_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER,
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
    }),
    
    // Secondary: Direct GitHub OAuth (for GitHub token acquisition)
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email repo read:org',
        },
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user, account }) {
      logger.info({ userId: user.id, provider: account?.provider }, 'User sign-in attempt');
      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // Initial sign-in or token refresh
      if (account && user) {
        token.userId = user.id;
        token.provider = account.provider;
        
        // Store GitHub token with AES-256-GCM key-ring encryption
        if (account.provider === 'github' && account.access_token) {
          await githubTokens.store(user.id!, {
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at 
              ? account.expires_at * 1000 
              : Date.now() + 8 * 60 * 60 * 1000,
            scopes: account.scope?.split(' '),
          });
          logger.info({ userId: user.id }, 'GitHub token stored with encryption');
        }
      }
      
      // Fetch memberships on sign-in or update trigger
      // This enables middleware to validate org membership without DB calls
      if ((account && user) || trigger === 'update') {
        const userId = token.userId as string;
        if (userId) {
          const memberships = await prisma.membership.findMany({
            where: { userId },
            select: {
              organizationId: true,
              role: true,
            },
          });
          // Store as map: { orgId: role } for O(1) lookup in middleware
          token.memberships = Object.fromEntries(
            memberships.map(m => [m.organizationId, m.role])
          );
          token.membershipsUpdatedAt = Date.now();
        }
      }
      
      // Refresh memberships every 5 minutes to catch permission changes
      const membershipsAge = Date.now() - (token.membershipsUpdatedAt as number || 0);
      if (membershipsAge > 5 * 60 * 1000 && token.userId) {
        const memberships = await prisma.membership.findMany({
          where: { userId: token.userId as string },
          select: {
            organizationId: true,
            role: true,
          },
        });
        token.memberships = Object.fromEntries(
          memberships.map(m => [m.organizationId, m.role])
        );
        token.membershipsUpdatedAt = Date.now();
      }
      
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.userId as string;
        
        // Only expose boolean flag - NEVER expose actual token
        const hasGitHub = await githubTokens.has(token.userId as string);
        session.user.hasGitHubConnection = hasGitHub;
      }
      
      return session;
    },
  },

  events: {
    async signIn({ user, account }) {
      logger.info({ userId: user.id, provider: account?.provider }, 'User signed in');
    },
    async signOut(message) {
      // Revoke tokens on logout (back-channel cleanup)
      const token = 'token' in message ? message.token : null;
      if (token?.userId) {
        await githubTokens.delete(token.userId as string);
        logger.info({ userId: token.userId }, 'User tokens revoked on sign-out');
      }
    },
  },

  debug: process.env.NODE_ENV === 'development',
};

// Export handlers
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

// =============================================================================
// Auth Utilities
// =============================================================================

import { redirect } from 'next/navigation';

export async function getSession() {
  return await auth();
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }
  return session;
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

// =============================================================================
// Permission Helpers
// =============================================================================

import { Role } from '@prisma/client';

export interface UserWithMembership {
  id: string;
  email: string;
  name: string | null;
  memberships: {
    role: Role;
    organizationId: string;
  }[];
}

export async function getUserWithMemberships(userId: string): Promise<UserWithMembership | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      memberships: {
        select: {
          role: true,
          organizationId: true,
        },
      },
    },
  });
}

export function hasPermission(
  user: UserWithMembership,
  organizationId: string,
  requiredRole: Role
): boolean {
  const membership = user.memberships.find(m => m.organizationId === organizationId);
  if (!membership) return false;
  
  const roleHierarchy: Record<Role, number> = {
    USER: 1,
    READWRITE: 2,
    ADMIN: 3,
  };
  
  return roleHierarchy[membership.role] >= roleHierarchy[requiredRole];
}
