export async function up(knex) {
    return knex.schema.createTable('bulk_operations', table => {
        // Primary key
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        // Timestamps
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('started_at');
        table.timestamp('completed_at');
        // User information
        table.string('user_id', 255).notNullable();
        table.string('user_email', 255);
        table.string('user_name', 255);
        // Operation details
        table.string('operation_type', 100).notNullable(); // 'bulk_update', 'bulk_commit', 'bulk_sync'
        table.string('repository', 255).notNullable();
        table.jsonb('target_branches').notNullable(); // Array of branch names
        table.string('file_path', 1000); // File being updated (if applicable)
        // Status tracking
        table.string('status', 50).notNullable().defaultTo('pending'); // 'pending', 'in_progress', 'completed', 'failed', 'partial'
        table.integer('total_targets').notNullable(); // Total number of branches/apps
        table.integer('successful_count').notNullable().defaultTo(0);
        table.integer('failed_count').notNullable().defaultTo(0);
        table.integer('pending_count').notNullable().defaultTo(0);
        // Progress tracking
        table.decimal('progress_percentage', 5, 2).defaultTo(0); // 0.00 to 100.00
        table.text('current_target'); // Current branch/app being processed
        // Results
        table.jsonb('results'); // Array of {branch, status, commit_sha, error}
        table.text('error_message'); // Overall error if operation failed
        table.jsonb('summary'); // Summary statistics
        // Change details
        table.text('change_description'); // User-provided description
        table.text('commit_message'); // Git commit message
        table.jsonb('change_preview'); // Preview of changes
        // ArgoCD sync details (if applicable)
        table.jsonb('argocd_apps'); // Array of ArgoCD app names
        table.jsonb('sync_results'); // Array of sync results
        // Metadata
        table.string('ip_address', 45);
        table.string('user_agent', 500);
        table.jsonb('metadata'); // Additional context
        // Rollback information
        table.boolean('can_rollback').defaultTo(false);
        table.uuid('rolled_back_by'); // References another bulk_operation id
        table.timestamp('rolled_back_at');
        // Indexes
        table.index('created_at');
        table.index('user_id');
        table.index('status');
        table.index('repository');
        table.index('operation_type');
        table.index(['status', 'created_at']); // For filtering active operations
    });
}
export async function down(knex) {
    return knex.schema.dropTable('bulk_operations');
}
//# sourceMappingURL=002_create_bulk_operations.js.map