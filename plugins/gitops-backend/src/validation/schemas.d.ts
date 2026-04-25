import Joi from 'joi';
/**
 * Validation schemas for GitOps API requests
 */
export declare const listRepositoriesSchema: Joi.ObjectSchema<any>;
export declare const listBranchesSchema: Joi.ObjectSchema<any>;
export declare const getFileTreeSchema: Joi.ObjectSchema<any>;
export declare const getFileContentSchema: Joi.ObjectSchema<any>;
export declare const updateFileSchema: Joi.ObjectSchema<any>;
export declare const listArgoCDAppsSchema: Joi.ObjectSchema<any>;
export declare const syncArgoCDAppSchema: Joi.ObjectSchema<any>;
export declare const getBulkOperationSchema: Joi.ObjectSchema<any>;
export declare const listBulkOperationsSchema: Joi.ObjectSchema<any>;
export declare const listAuditLogsSchema: Joi.ObjectSchema<any>;
export declare function validate<T>(schema: Joi.ObjectSchema, data: any): T;
//# sourceMappingURL=schemas.d.ts.map