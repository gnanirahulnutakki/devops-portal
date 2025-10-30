/**
 * GitOps Backend Types
 *
 * Type definitions for the GitOps Management Portal backend
 */
// ============================================================================
// Error Types
// ============================================================================
export class GitOpsError extends Error {
    constructor(message, statusCode = 500, code, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = 'GitOpsError';
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
//# sourceMappingURL=index.js.map