import Joi from 'joi';
/**
 * Validation schemas for GitOps API requests
 */
// ===========================================================================
// Repository Operations
// ===========================================================================
export const listRepositoriesSchema = Joi.object({
    organization: Joi.string().optional(),
    filter: Joi.string().max(255).optional(),
});
export const listBranchesSchema = Joi.object({
    repository: Joi.string().required().max(255),
    filter: Joi.string().max(255).optional(),
});
export const getFileTreeSchema = Joi.object({
    repository: Joi.string().required().max(255),
    branch: Joi.string().required().max(255),
    path: Joi.string().max(1000).optional().default(''),
});
export const getFileContentSchema = Joi.object({
    repository: Joi.string().required().max(255),
    branch: Joi.string().required().max(255),
    path: Joi.string().required().max(1000),
});
// ===========================================================================
// File Update Operations
// ===========================================================================
export const updateFileSchema = Joi.object({
    repository: Joi.string().required().max(255),
    branches: Joi.array()
        .items(Joi.string().max(255))
        .min(1)
        .max(50) // Limit bulk operations to 50 branches
        .required(),
    path: Joi.string().required().max(1000),
    content: Joi.string().optional(),
    message: Joi.string().required().min(1).max(500),
    committer: Joi.object({
        name: Joi.string().required().max(255),
        email: Joi.string().email().required(),
    }).optional(),
    // Field-level editing support
    fieldPath: Joi.string().optional().max(500),
    fieldValue: Joi.string().optional(),
}).custom((value, helpers) => {
    // Either content OR (fieldPath AND fieldValue) must be provided
    const hasContent = value.content !== undefined && value.content !== null;
    const hasFieldUpdate = value.fieldPath && value.fieldValue !== undefined;
    if (!hasContent && !hasFieldUpdate) {
        return helpers.error('custom.requireContentOrField');
    }
    if (hasContent && hasFieldUpdate) {
        return helpers.error('custom.contentOrFieldNotBoth');
    }
    return value;
}, 'Content or Field validation').messages({
    'custom.requireContentOrField': 'Either "content" or both "fieldPath" and "fieldValue" must be provided',
    'custom.contentOrFieldNotBoth': 'Cannot provide both "content" and "fieldPath/fieldValue" - choose one update method',
});
// ===========================================================================
// ArgoCD Operations
// ===========================================================================
export const listArgoCDAppsSchema = Joi.object({
    filter: Joi.string().max(255).optional(),
    branch: Joi.string().max(255).optional(),
});
export const syncArgoCDAppSchema = Joi.object({
    applications: Joi.array()
        .items(Joi.string().max(255))
        .min(1)
        .max(100) // Limit bulk sync to 100 apps
        .required(),
    prune: Joi.boolean().optional().default(false),
    dryRun: Joi.boolean().optional().default(false),
});
// ===========================================================================
// Bulk Operations
// ===========================================================================
export const getBulkOperationSchema = Joi.object({
    operation_id: Joi.string().uuid().required(),
});
export const listBulkOperationsSchema = Joi.object({
    user_id: Joi.string().max(255).optional(),
    status: Joi.string()
        .valid('pending', 'in_progress', 'completed', 'failed', 'partial')
        .optional(),
    operation_type: Joi.string()
        .valid('bulk_update', 'bulk_commit', 'bulk_sync')
        .optional(),
    limit: Joi.number().integer().min(1).max(100).optional().default(20),
    offset: Joi.number().integer().min(0).optional().default(0),
});
// ===========================================================================
// Audit Logs
// ===========================================================================
export const listAuditLogsSchema = Joi.object({
    user_id: Joi.string().max(255).optional(),
    operation: Joi.string()
        .valid('read', 'update', 'commit', 'sync', 'delete')
        .optional(),
    resource_type: Joi.string()
        .valid('repository', 'branch', 'file', 'argocd_app')
        .optional(),
    repository: Joi.string().max(255).optional(),
    branch: Joi.string().max(255).optional(),
    status: Joi.string().valid('success', 'failure', 'pending').optional(),
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().min(Joi.ref('start_date')).optional(),
    limit: Joi.number().integer().min(1).max(1000).optional().default(100),
    offset: Joi.number().integer().min(0).optional().default(0),
});
// ===========================================================================
// Validation Helper
// ===========================================================================
export function validate(schema, data) {
    const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        const details = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
        }));
        throw {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details,
        };
    }
    return value;
}
//# sourceMappingURL=schemas.js.map