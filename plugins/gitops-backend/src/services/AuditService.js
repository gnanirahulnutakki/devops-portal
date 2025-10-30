import { v4 as uuidv4 } from 'uuid';
/**
 * AuditService
 *
 * Handles audit logging for all GitOps operations
 * Provides compliance and debugging capabilities
 */
export class AuditService {
    constructor(config) {
        this.db = config.database;
    }
    /**
     * Log an operation to the audit trail
     */
    async log(entry) {
        const auditEntry = {
            id: uuidv4(),
            created_at: new Date(),
            ...entry,
        };
        await this.db('audit_logs').insert(auditEntry);
        return auditEntry.id;
    }
    /**
     * Log a successful read operation
     */
    async logRead(params) {
        return this.log({
            ...params,
            operation: 'read',
            status: 'success',
        });
    }
    /**
     * Log a file update operation
     */
    async logUpdate(params) {
        return this.log({
            ...params,
            operation: 'update',
        });
    }
    /**
     * Log a commit operation
     */
    async logCommit(params) {
        return this.log({
            ...params,
            operation: 'commit',
        });
    }
    /**
     * Log an ArgoCD sync operation
     */
    async logSync(params) {
        return this.log({
            ...params,
            operation: 'sync',
        });
    }
    /**
     * Get audit logs with filtering
     */
    async getLogs(filters) {
        let query = this.db('audit_logs');
        // Apply filters
        if (filters.user_id) {
            query = query.where('user_id', filters.user_id);
        }
        if (filters.operation) {
            query = query.where('operation', filters.operation);
        }
        if (filters.resource_type) {
            query = query.where('resource_type', filters.resource_type);
        }
        if (filters.repository) {
            query = query.where('repository', filters.repository);
        }
        if (filters.branch) {
            query = query.where('branch', filters.branch);
        }
        if (filters.status) {
            query = query.where('status', filters.status);
        }
        if (filters.start_date) {
            query = query.where('created_at', '>=', filters.start_date);
        }
        if (filters.end_date) {
            query = query.where('created_at', '<=', filters.end_date);
        }
        // Get total count
        const countResult = await query.clone().count('* as count').first();
        const total = Number(countResult?.count || 0);
        // Get logs with pagination
        const logs = await query
            .orderBy('created_at', 'desc')
            .limit(filters.limit || 100)
            .offset(filters.offset || 0);
        return { logs, total };
    }
    /**
     * Get recent activity for a user
     */
    async getUserActivity(userId, limit = 20) {
        return this.db('audit_logs')
            .where('user_id', userId)
            .orderBy('created_at', 'desc')
            .limit(limit);
    }
    /**
     * Get activity for a specific repository
     */
    async getRepositoryActivity(repository, limit = 100) {
        return this.db('audit_logs')
            .where('repository', repository)
            .orderBy('created_at', 'desc')
            .limit(limit);
    }
    /**
     * Get activity for a specific branch
     */
    async getBranchActivity(repository, branch, limit = 100) {
        return this.db('audit_logs')
            .where('repository', repository)
            .where('branch', branch)
            .orderBy('created_at', 'desc')
            .limit(limit);
    }
    /**
     * Get failed operations for troubleshooting
     */
    async getFailedOperations(limit = 50) {
        return this.db('audit_logs')
            .where('status', 'failure')
            .orderBy('created_at', 'desc')
            .limit(limit);
    }
    /**
     * Get statistics for a time period
     */
    async getStatistics(params) {
        let baseQuery = this.db('audit_logs')
            .whereBetween('created_at', [params.start_date, params.end_date]);
        if (params.repository) {
            baseQuery = baseQuery.where('repository', params.repository);
        }
        // Total operations
        const totalResult = await baseQuery.clone().count('* as count').first();
        const total_operations = Number(totalResult?.count || 0);
        // Successful operations
        const successResult = await baseQuery
            .clone()
            .where('status', 'success')
            .count('* as count')
            .first();
        const successful_operations = Number(successResult?.count || 0);
        // Failed operations
        const failedResult = await baseQuery
            .clone()
            .where('status', 'failure')
            .count('* as count')
            .first();
        const failed_operations = Number(failedResult?.count || 0);
        // Operations by type
        const operationsByType = await baseQuery
            .clone()
            .select('operation')
            .count('* as count')
            .groupBy('operation');
        const operations_by_type = {};
        operationsByType.forEach(row => {
            operations_by_type[row.operation] = Number(row.count);
        });
        // Top users
        const topUsersResult = await baseQuery
            .clone()
            .select('user_id')
            .count('* as count')
            .groupBy('user_id')
            .orderBy('count', 'desc')
            .limit(10);
        const top_users = topUsersResult.map(row => ({
            user_id: row.user_id,
            count: Number(row.count),
        }));
        return {
            total_operations,
            successful_operations,
            failed_operations,
            operations_by_type,
            top_users,
        };
    }
}
//# sourceMappingURL=AuditService.js.map