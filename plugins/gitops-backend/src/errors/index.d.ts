import { Response } from 'express';
/**
 * Error handling utilities for GitOps backend
 */
export declare class GitOpsError extends Error {
    statusCode: number;
    code?: string;
    details?: any;
    constructor(message: string, statusCode?: number, code?: string, details?: any);
}
export declare class GitHubError extends GitOpsError {
    constructor(message: string, statusCode?: number, details?: any);
}
export declare class ArgoCDError extends GitOpsError {
    constructor(message: string, statusCode?: number, details?: any);
}
export declare class ValidationError extends GitOpsError {
    constructor(message: string, details?: any);
}
export declare class NotFoundError extends GitOpsError {
    constructor(message: string, details?: any);
}
export declare class UnauthorizedError extends GitOpsError {
    constructor(message: string, details?: any);
}
export declare class ForbiddenError extends GitOpsError {
    constructor(message: string, details?: any);
}
/**
 * Error response handler
 */
export declare function handleError(error: any, res: Response): void;
/**
 * Async error wrapper for Express routes
 */
export declare function asyncHandler(fn: (req: any, res: Response, next: any) => Promise<any>): (req: any, res: Response, next: any) => void;
//# sourceMappingURL=index.d.ts.map