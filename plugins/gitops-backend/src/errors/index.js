/**
 * Error handling utilities for GitOps backend
 */
export class GitOpsError extends Error {
    constructor(message, statusCode = 500, code, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = 'GitOpsError';
        Error.captureStackTrace(this, this.constructor);
    }
}
export class GitHubError extends GitOpsError {
    constructor(message, statusCode = 500, details) {
        super(message, statusCode, 'GITHUB_ERROR', details);
        this.name = 'GitHubError';
    }
}
export class ArgoCDError extends GitOpsError {
    constructor(message, statusCode = 500, details) {
        super(message, statusCode, 'ARGOCD_ERROR', details);
        this.name = 'ArgoCDError';
    }
}
export class ValidationError extends GitOpsError {
    constructor(message, details) {
        super(message, 400, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}
export class NotFoundError extends GitOpsError {
    constructor(message, details) {
        super(message, 404, 'NOT_FOUND', details);
        this.name = 'NotFoundError';
    }
}
export class UnauthorizedError extends GitOpsError {
    constructor(message, details) {
        super(message, 401, 'UNAUTHORIZED', details);
        this.name = 'UnauthorizedError';
    }
}
export class ForbiddenError extends GitOpsError {
    constructor(message, details) {
        super(message, 403, 'FORBIDDEN', details);
        this.name = 'ForbiddenError';
    }
}
/**
 * Error response handler
 */
export function handleError(error, res) {
    // Log error for debugging
    console.error('[GitOps Error]', {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
    // Handle custom GitOps errors
    if (error instanceof GitOpsError) {
        res.status(error.statusCode).json({
            error: {
                code: error.code,
                message: error.message,
                details: error.details,
                timestamp: new Date().toISOString(),
            },
        });
        return;
    }
    // Handle validation errors from Joi
    if (error.statusCode === 400 && error.code === 'VALIDATION_ERROR') {
        res.status(400).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: error.message,
                details: error.details,
                timestamp: new Date().toISOString(),
            },
        });
        return;
    }
    // Handle unexpected errors
    const statusCode = error.statusCode || error.status || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message || 'An unexpected error occurred';
    res.status(statusCode).json({
        error: {
            code: error.code || 'INTERNAL_ERROR',
            message: message,
            timestamp: new Date().toISOString(),
            ...(process.env.NODE_ENV === 'development' && {
                stack: error.stack,
            }),
        },
    });
}
/**
 * Async error wrapper for Express routes
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((error) => {
            handleError(error, res);
        });
    };
}
//# sourceMappingURL=index.js.map