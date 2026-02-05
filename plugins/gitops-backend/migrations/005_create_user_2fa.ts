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

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('user_2fa', table => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // User reference (one-to-one, unique constraint)
    table.uuid('user_id').notNullable().unique()
      .references('id').inTable('users')
      .onDelete('CASCADE')
      .onUpdate('CASCADE');

    // TOTP configuration
    table.boolean('is_enabled').notNullable().defaultTo(false);
    table.text('totp_secret'); // Encrypted TOTP secret (AES-256-GCM)
    table.string('totp_algorithm', 10).defaultTo('SHA1'); // SHA1, SHA256, SHA512
    table.integer('totp_digits').defaultTo(6);
    table.integer('totp_period').defaultTo(30); // seconds
    table.timestamp('enabled_at');
    table.timestamp('disabled_at');

    // Backup codes (8 codes, bcrypt hashed, one-time use)
    // Format: [{ code_hash: string, used: boolean, used_at: timestamp }]
    table.jsonb('backup_codes');
    table.integer('backup_codes_remaining').notNullable().defaultTo(0);
    table.timestamp('backup_codes_generated_at');

    // Trusted devices (skip 2FA for 30 days)
    // Format: [{ fingerprint, ip, user_agent, trusted_until, created_at }]
    table.jsonb('trusted_devices');

    // Recovery options
    table.string('recovery_email', 255); // Alternative email for recovery
    table.string('recovery_phone', 50); // Phone for SMS recovery (future)
    table.string('recovery_token_hash', 255);
    table.timestamp('recovery_token_expires');

    // Audit timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Last verification tracking
    table.timestamp('last_totp_verified_at');
    table.timestamp('last_backup_code_used_at');

    // Extensible metadata
    table.jsonb('metadata');

    // Indexes
    table.index('user_id', 'idx_2fa_user_id');
    table.index('is_enabled', 'idx_2fa_is_enabled');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('user_2fa');
}
