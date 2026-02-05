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

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('user_sessions', table => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // User reference (cascade delete when user is deleted)
    table.uuid('user_id').notNullable()
      .references('id').inTable('users')
      .onDelete('CASCADE')
      .onUpdate('CASCADE');

    // Session token (SHA-256 hash of JWT, not plaintext)
    table.string('token_hash', 255).notNullable().unique();

    // Session lifecycle
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
    table.timestamp('last_active_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('refreshed_at'); // Last token refresh

    // Client information (for security audit)
    table.string('ip_address', 45); // IPv4 or IPv6
    table.string('user_agent', 500);
    table.string('device_fingerprint', 255); // Browser/device fingerprint
    table.string('device_name', 255); // User-friendly device name

    // 2FA status for this session
    table.boolean('is_2fa_verified').notNullable().defaultTo(false);
    table.timestamp('tfa_verified_at');

    // Remember device (skip 2FA for trusted devices)
    table.boolean('remember_device').notNullable().defaultTo(false);
    table.timestamp('device_trusted_until');

    // Session revocation
    table.boolean('is_revoked').notNullable().defaultTo(false);
    table.timestamp('revoked_at');
    table.string('revoked_reason', 255); // logout, password_change, admin_action, etc.
    table.string('revoked_by', 255); // User ID who revoked (self or admin)

    // Session type
    table.enum('session_type', ['web', 'api', 'mobile']).defaultTo('web');

    // Extensible metadata
    table.jsonb('metadata');

    // Indexes for efficient queries
    table.index('user_id', 'idx_sessions_user_id');
    table.index('token_hash', 'idx_sessions_token_hash');
    table.index('expires_at', 'idx_sessions_expires_at');
    table.index('is_revoked', 'idx_sessions_is_revoked');
    table.index(['user_id', 'is_revoked'], 'idx_sessions_user_active');
    table.index(['expires_at', 'is_revoked'], 'idx_sessions_valid');
    table.index('device_fingerprint', 'idx_sessions_device');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('user_sessions');
}
