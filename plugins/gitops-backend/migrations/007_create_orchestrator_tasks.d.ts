/**
 * Migration 007: Create Orchestrator Tasks Table
 *
 * Central Orchestrator for task management:
 * - Track all async operations (bulk updates, deployments, etc.)
 * - Progress tracking with WebSocket updates
 * - Task dependencies and workflow coordination
 * - Retry logic with exponential backoff
 */
import { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=007_create_orchestrator_tasks.d.ts.map