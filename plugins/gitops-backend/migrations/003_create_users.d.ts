/**
 * Migration 003: Create Users Table
 *
 * Enterprise local authentication users with:
 * - Username/password authentication
 * - Three-tier RBAC (user, readwrite, admin)
 * - Account lockout protection
 * - Password change tracking
 */
import { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=003_create_users.d.ts.map