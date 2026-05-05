import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';
import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import AzureADProvider from 'next-auth/providers/azure-ad';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';
import { githubTokens } from './token-store';
import { logger } from './logger';
import bcrypt from 'bcryptjs';

// =============================================================================
// Password Hashing (bcrypt with configurable cost factor)
// =============================================================================

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// =============================================================================
// Auth Configuration
// =============================================================================

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  
  providers: (() => {
    /**
     * Default to Keycloak-only, even in development.
     * This helps catch auth/config problems early and reduces attack surface.
     *
     * To re-enable other providers for local experiments, explicitly set:
     *   AUTH_MODE=multi
     */
    const authMode = (process.env.AUTH_MODE || 'keycloak-only').toLowerCase();
    const keycloakConfigured = !!(process.env.KEYCLOAK_ID && process.env.KEYCLOAK_SECRET && process.env.KEYCLOAK_ISSUER);

    if (authMode !== 'multi') {
      if (!keycloakConfigured) {
        logger.error(
          'AUTH_MODE is keycloak-only but Keycloak is not configured. Set KEYCLOAK_ID, KEYCLOAK_SECRET, KEYCLOAK_ISSUER.'
        );
        return [];
      }
      return [
        KeycloakProvider({
          clientId: process.env.KEYCLOAK_ID!,
          clientSecret: process.env.KEYCLOAK_SECRET!,
          issuer: process.env.KEYCLOAK_ISSUER!,
          /**
           * Keycloak-only mode:
           * If a user previously existed (e.g., from older GitHub/credentials experiments),
           * NextAuth would otherwise block SSO with OAuthAccountNotLinked.
           *
           * In this environment Keycloak is the ONLY login method, so linking by verified email
           * is the desired behavior.
           */
          allowDangerousEmailAccountLinking: true,
          authorization: {
            params: {
              scope: 'openid email profile',
            },
          },
        }),
      ];
    }

    // Multi-provider mode (opt-in)
    return [
      ...(process.env.ENABLE_CREDENTIALS_AUTH === 'true'
        ? [
            CredentialsProvider({
              id: 'credentials',
              name: 'Email & Password',
              credentials: {
                email: { label: 'Email', type: 'email', placeholder: 'admin@example.com' },
                password: { label: 'Password', type: 'password', placeholder: '••••••••' },
              },
              async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                  return null;
                }

                const email = credentials.email as string;
                const password = credentials.password as string;

                const user = await prisma.user.findUnique({
                  where: { email },
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    image: true,
                    passwordHash: true,
                  },
                });

                if (!user) {
                  logger.warn({ email }, 'Login attempt for non-existent user');
                  return null;
                }

                if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
                  logger.warn({ email }, 'Invalid password attempt');
                  return null;
                }

                logger.info({ userId: user.id, email }, 'Credentials login successful');

                return {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  image: user.image,
                };
              },
            }),
          ]
        : []),

      ...(keycloakConfigured
        ? [
            KeycloakProvider({
              clientId: process.env.KEYCLOAK_ID!,
              clientSecret: process.env.KEYCLOAK_SECRET!,
              issuer: process.env.KEYCLOAK_ISSUER!,
              allowDangerousEmailAccountLinking: true,
              authorization: {
                params: {
                  scope: 'openid email profile',
                },
              },
            }),
          ]
        : []),

      ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? [
            GoogleProvider({
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              authorization: {
                params: {
                  scope: 'openid email profile',
                },
              },
            }),
          ]
        : []),

      ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET
        ? [
            AzureADProvider({
              clientId: process.env.AZURE_AD_CLIENT_ID,
              clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
              issuer: process.env.AZURE_AD_TENANT_ID
                ? `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`
                : undefined,
              authorization: {
                params: {
                  scope: 'openid email profile',
                },
              },
            }),
          ]
        : []),

      ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ? [
            GitHubProvider({
              clientId: process.env.GITHUB_CLIENT_ID,
              clientSecret: process.env.GITHUB_CLIENT_SECRET,
              async profile(profile, tokens) {
                let email = profile.email as string | null | undefined;
                if (!email && tokens.access_token) {
                  try {
                    const res = await fetch('https://api.github.com/user/emails', {
                      headers: {
                        Authorization: `Bearer ${tokens.access_token}`,
                        Accept: 'application/vnd.github+json',
                      },
                    });
                    if (res.ok) {
                      const emails = (await res.json()) as Array<{
                        email: string;
                        primary: boolean;
                        verified: boolean;
                      }>;
                      const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified);
                      email = primary?.email;
                    }
                  } catch {
                    // ignore
                  }
                }

                return {
                  id: String(profile.id),
                  name: profile.name || profile.login,
                  email: email || undefined,
                  image: profile.avatar_url,
                };
              },
              authorization: {
                params: {
                  scope: 'read:user user:email repo read:org',
                },
              },
            }),
          ]
        : []),
    ];
  })(),

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user, account, profile: _profile }) {
      logger.info(
        { userId: user.id, provider: account?.provider, email: user.email },
        'User sign-in attempt'
      );

      // Optional: Gate GitHub OAuth to specific org members
      // Enable by setting GITHUB_ALLOWED_ORG env var (e.g., "radiantlogic-devops")
      if (account?.provider === 'github' && process.env.GITHUB_ALLOWED_ORG) {
        try {
          const res = await fetch('https://api.github.com/user/orgs', {
            headers: {
              Authorization: `Bearer ${account.access_token}`,
              Accept: 'application/vnd.github+json',
            },
          });
          if (res.ok) {
            const orgs = await res.json() as Array<{ login: string }>;
            const allowedOrg = process.env.GITHUB_ALLOWED_ORG;
            const isMember = orgs.some(
              (org) => org.login.toLowerCase() === allowedOrg!.toLowerCase()
            );
            if (!isMember) {
              logger.warn(
                { userId: user.id, email: user.email, allowedOrg },
                'GitHub sign-in rejected: user not a member of required organization'
              );
              return false;
            }
          }
        } catch (error) {
          // Don't block sign-in if org check fails (degraded but available)
          logger.error({ error: (error as Error).message }, 'GitHub org membership check failed');
        }
      }

      // Auto-provision: add new OAuth users to the default organization
      // This prevents users from getting stuck at the "no org" screen after OAuth sign-in.
      // Controlled by DEFAULT_ORG_SLUG env var (defaults to "default" from seed).
      if (account?.provider && account.provider !== 'credentials' && user.id) {
        try {
          const defaultOrgSlug = process.env.DEFAULT_ORG_SLUG || 'default';
          const defaultOrg = await prisma.organization.findUnique({
            where: { slug: defaultOrgSlug },
          });
          if (defaultOrg) {
            const existingMembership = await prisma.membership.findUnique({
              where: {
                userId_organizationId: {
                  userId: user.id,
                  organizationId: defaultOrg.id,
                },
              },
            });
            if (!existingMembership) {
              const defaultRole = (process.env.DEFAULT_ORG_ROLE || 'USER') as 'USER' | 'READWRITE' | 'ADMIN';
              await prisma.membership.create({
                data: {
                  userId: user.id,
                  organizationId: defaultOrg.id,
                  role: defaultRole,
                },
              });
              logger.info(
                { userId: user.id, orgSlug: defaultOrgSlug, role: defaultRole },
                'Auto-provisioned OAuth user into default organization'
              );
            }
          } else {
            logger.warn(
              { slug: defaultOrgSlug },
              'Default organization not found for auto-provisioning'
            );
          }
        } catch (error) {
          // Don't block sign-in if auto-provisioning fails
          logger.error(
            { error: (error as Error).message, userId: user.id },
            'Failed to auto-provision org membership for OAuth user'
          );
        }
      }

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
      const membershipsAge = Date.now() - (token.membershipsUpdatedAt ?? 0);
      if (membershipsAge > 5 * 60 * 1000 && token.userId) {
        const memberships = await prisma.membership.findMany({
          where: { userId: token.userId },
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
      // NextAuth v5 signOut message can be { token } or { session } depending on strategy
      try {
        const token = 'token' in message ? message.token : null;
        const userId = token?.userId as string | undefined;
        if (userId) {
          await githubTokens.delete(userId);
          logger.info({ userId }, 'User tokens revoked on sign-out');
        }
      } catch (error) {
        // Don't block sign-out if token cleanup fails
        logger.error({ error: (error as Error).message }, 'Failed to clean up tokens on sign-out');
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
