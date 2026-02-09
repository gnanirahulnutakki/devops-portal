import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('audit_logs', table => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Timestamp
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // User information
    table.string('user_id', 255).notNullable();
    table.string('user_email', 255);
    table.string('user_name', 255);

    // Operation details
    table.string('operation', 100).notNullable(); // 'read', 'update', 'commit', 'sync'
    table.string('resource_type', 100).notNullable(); // 'repository', 'branch', 'file', 'argocd_app'
    table.string('resource_id', 500).notNullable(); // repo/branch/file path or app name

    // Repository context
    table.string('repository', 255);
    table.string('branch', 255);
    table.string('file_path', 1000);

    // Change details
    table.text('old_value'); // Previous file content or state
    table.text('new_value'); // New file content or state
    table.text('diff'); // Git diff or change summary

    // Metadata
    table.string('commit_sha', 40); // Git commit SHA if applicable
    table.string('argocd_app_name', 255); // ArgoCD app name if applicable
    table.string('sync_status', 50); // ArgoCD sync status if applicable

    // Request context
    table.string('ip_address', 45); // IPv4 or IPv6
    table.string('user_agent', 500);
    table.jsonb('metadata'); // Additional context

    // Status
    table.string('status', 50).notNullable(); // 'success', 'failure', 'pending'
    table.text('error_message'); // If status is failure

    // Indexes for common queries
    table.index('created_at');
    table.index('user_id');
    table.index('operation');
    table.index('resource_type');
    table.index(['repository', 'branch']);
    table.index('status');
    table.index('commit_sha');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('audit_logs');
}
