/**
 * Migration 007: Create Orchestrator Tasks Table
 *
 * Central Orchestrator for task management:
 * - Track all async operations (bulk updates, deployments, etc.)
 * - Progress tracking with WebSocket updates
 * - Task dependencies and workflow coordination
 * - Retry logic with exponential backoff
 */
export async function up(knex) {
    return knex.schema.createTable('orchestrator_tasks', table => {
        // Primary key
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        // Task identification
        table.string('task_type', 100).notNullable(); // bulk_update, deployment, sync, etc.
        table.string('name', 255).notNullable(); // Human-readable task name
        table.text('description'); // Detailed description
        // User who initiated the task
        table.uuid('user_id')
            .references('id').inTable('users')
            .onDelete('SET NULL')
            .onUpdate('CASCADE');
        table.string('initiated_by', 255); // Username for audit trail (survives user deletion)
        // Task status
        table.enum('status', [
            'pending',
            'queued',
            'running',
            'paused',
            'completed',
            'failed',
            'cancelled',
            'timeout' // Exceeded max duration
        ]).notNullable().defaultTo('pending');
        // Priority (higher = more important)
        table.integer('priority').notNullable().defaultTo(5); // 1-10 scale
        // Progress tracking
        table.integer('progress_percentage').notNullable().defaultTo(0); // 0-100
        table.string('progress_message', 500); // Current step description
        table.integer('total_items').defaultTo(0); // For batch operations
        table.integer('completed_items').defaultTo(0);
        table.integer('failed_items').defaultTo(0);
        // Input/Output data (JSONB for flexibility)
        table.jsonb('input_data'); // Task parameters
        table.jsonb('output_data'); // Task results
        table.jsonb('context'); // Runtime context (session info, etc.)
        // Timing
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('scheduled_at'); // When to start (for delayed tasks)
        table.timestamp('started_at');
        table.timestamp('completed_at');
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
        // Duration limits
        table.integer('max_duration_seconds').defaultTo(3600); // 1 hour default
        table.integer('actual_duration_seconds');
        // Retry configuration
        table.integer('retry_count').notNullable().defaultTo(0);
        table.integer('max_retries').notNullable().defaultTo(3);
        table.timestamp('last_retry_at');
        table.timestamp('next_retry_at');
        // Error tracking
        table.text('error_message');
        table.text('error_stack');
        table.string('error_code', 100);
        // Task dependencies (for workflow coordination)
        table.specificType('depends_on', 'uuid[]'); // Array of task IDs that must complete first
        table.specificType('blocked_by', 'uuid[]'); // Tasks currently blocking this one
        // Worker assignment
        table.string('worker_id', 255); // Which worker is handling this
        table.string('worker_hostname', 255);
        // Cancellation
        table.boolean('cancellation_requested').notNullable().defaultTo(false);
        table.timestamp('cancellation_requested_at');
        table.string('cancelled_by', 255);
        table.string('cancellation_reason', 500);
        // WebSocket notification
        table.boolean('notify_on_complete').notNullable().defaultTo(true);
        table.jsonb('notification_channels'); // WebSocket room IDs to notify
        // Extensible metadata
        table.jsonb('metadata');
        // Indexes for efficient queries
        table.index('task_type', 'idx_tasks_type');
        table.index('status', 'idx_tasks_status');
        table.index('user_id', 'idx_tasks_user_id');
        table.index('priority', 'idx_tasks_priority');
        table.index('created_at', 'idx_tasks_created_at');
        table.index(['status', 'priority'], 'idx_tasks_status_priority');
        table.index(['status', 'scheduled_at'], 'idx_tasks_scheduled');
        table.index('worker_id', 'idx_tasks_worker');
    });
}
export async function down(knex) {
    return knex.schema.dropTableIfExists('orchestrator_tasks');
}
//# sourceMappingURL=007_create_orchestrator_tasks.js.map