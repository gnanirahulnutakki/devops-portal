/**
 * Migration 005: Create User 2FA Table
 *
 * Two-Factor Authentication (TOTP):
 * - TOTP secret (encrypted at rest)
 * - Backup codes (8 codes, one-time use)
 * - Trusted devices (30-day remember)
 * - Recovery options
 */
import { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=005_create_user_2fa.d.ts.map