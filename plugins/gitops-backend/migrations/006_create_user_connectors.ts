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

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('user_connectors', table => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // User reference (one user can have multiple connectors)
    table.uuid('user_id').notNullable()
      .references('id').inTable('users')
      .onDelete('CASCADE')
      .onUpdate('CASCADE');

    // Provider identification
    table.string('provider', 50).notNullable(); // github, gitlab, microsoft, google
    table.string('provider_user_id', 255); // External user ID from provider
    table.string('provider_username', 255); // External username
    table.string('provider_email', 255); // Email from provider
    table.string('provider_avatar_url', 500); // Profile picture

    // OAuth tokens (encrypted at rest with AES-256-GCM)
    table.text('access_token'); // Encrypted access token
    table.text('refresh_token'); // Encrypted refresh token
    table.timestamp('access_token_expires_at');
    table.timestamp('refresh_token_expires_at');

    // Token metadata
    table.string('token_type', 50).defaultTo('Bearer');
    table.jsonb('scopes'); // Array of granted scopes ['repo', 'read:org', etc.]

    // Connection status
    table.enum('status', ['active', 'expired', 'revoked', 'error']).defaultTo('active');
    table.string('last_error', 500); // Last error message if status is 'error'

    // Timestamps
    table.timestamp('connected_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('last_used_at');
    table.timestamp('disconnected_at');
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // OAuth state for CSRF protection during flow
    table.string('oauth_state', 255);
    table.timestamp('oauth_state_expires');

    // Extensible metadata (org memberships, teams, etc.)
    table.jsonb('metadata');

    // Indexes
    table.unique(['user_id', 'provider'], { indexName: 'idx_connectors_user_provider' });
    table.index('provider', 'idx_connectors_provider');
    table.index('status', 'idx_connectors_status');
    table.index('provider_user_id', 'idx_connectors_provider_user_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('user_connectors');
}
