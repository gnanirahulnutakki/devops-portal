/**
 * Migration 006: Create User Connectors Table
 *
 * OAuth Connectors (like ChatGPT plugins):
 * - Store user's connected OAuth providers (GitHub, GitLab, Microsoft)
 * - Encrypted access/refresh tokens (AES-256-GCM)
 * - Scopes and permissions tracking
 * - Enables user-specific repo access
 */
import { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=006_create_user_connectors.d.ts.map