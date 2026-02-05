/**
 * Migration 004: Create User Sessions Table
 *
 * Session management for local authentication:
 * - JWT token tracking (hash stored, not plaintext)
 * - Session expiry and refresh
 * - Device fingerprinting
 * - 2FA verification status
 * - Admin session revocation
 */
import { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=004_create_user_sessions.d.ts.map