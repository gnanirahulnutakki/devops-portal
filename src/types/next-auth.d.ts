import { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      hasGitHubConnection?: boolean;
      // OAuth connections are fetched via `/api/auth/connections` for accuracy
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    id: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    userId?: string;
    provider?: string;
    /** Map of organizationId -> role for O(1) membership checks in middleware */
    memberships?: Record<string, string>;
    /** Timestamp (ms) of last membership refresh */
    membershipsUpdatedAt?: number;
  }
}
