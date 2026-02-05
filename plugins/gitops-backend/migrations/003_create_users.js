/**
 * Migration 003: Create Users Table
 *
 * Enterprise local authentication users with:
 * - Username/password authentication
 * - Three-tier RBAC (user, readwrite, admin)
 * - Account lockout protection
 * - Password change tracking
 */
export async function up(knex) {
    // Check if pg_crypto extension is available for gen_random_uuid()
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"').catch(() => {
        // Extension might already exist or not be available
    });
    return knex.schema.createTable('users', table => {
        // Primary key
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        // Timestamps
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
        // Authentication credentials
        table.string('username', 100).notNullable().unique();
        table.string('email', 255).notNullable().unique();
        table.string('password_hash', 255).notNullable(); // bcrypt hash (cost 12)
        table.string('display_name', 255);
        // Three-tier RBAC role
        // - user: read-only access (VIEWER)
        // - readwrite: read + write access (DEVELOPER)
        // - admin: full access + user management (ADMIN)
        table.enum('role', ['user', 'readwrite', 'admin']).notNullable().defaultTo('user');
        // Account status
        table.boolean('is_active').notNullable().defaultTo(true);
        table.boolean('email_verified').notNullable().defaultTo(false);
        table.string('email_verification_token', 255);
        table.timestamp('email_verification_expires');
        table.timestamp('last_login');
        // Account lockout (brute force protection)
        table.integer('failed_login_attempts').notNullable().defaultTo(0);
        table.timestamp('locked_until');
        table.timestamp('last_failed_login');
        // Password policy
        table.timestamp('password_changed_at').defaultTo(knex.fn.now());
        table.boolean('force_password_change').notNullable().defaultTo(false);
        table.jsonb('password_history'); // Array of previous password hashes
        // Password reset
        table.string('password_reset_token', 255);
        table.timestamp('password_reset_expires');
        // Admin tracking
        table.string('created_by', 255); // Admin user ID who created this account
        table.string('updated_by', 255); // Last admin who modified this account
        // Extensible metadata
        table.jsonb('metadata');
        // Indexes for common queries
        table.index('email', 'idx_users_email');
        table.index('username', 'idx_users_username');
        table.index('role', 'idx_users_role');
        table.index('is_active', 'idx_users_is_active');
        table.index('created_at', 'idx_users_created_at');
        table.index(['is_active', 'role'], 'idx_users_active_role');
    });
}
export async function down(knex) {
    return knex.schema.dropTableIfExists('users');
}
//# sourceMappingURL=003_create_users.js.map