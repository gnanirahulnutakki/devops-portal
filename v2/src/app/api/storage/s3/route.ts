import { 
  withTenantApiHandler,
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { 
  listObjects, 
  generateSignedUrl, 
  deleteObject, 
  isS3Configured,
  getMimeType,
  isValidS3Key,
  sanitizeS3Key,
} from '@/lib/services/s3';

// List objects in S3 bucket
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const configured = await isS3Configured(ctx.tenant.organizationId);
      if (!configured) {
        return errorResponse('S3_NOT_CONFIGURED', 'S3 is not configured for this organization', 400);
      }

      const { searchParams } = new URL(request.url);
      const prefix = searchParams.get('prefix') || '';
      const continuationToken = searchParams.get('continuationToken') || undefined;
      const maxKeys = parseInt(searchParams.get('maxKeys') || '100', 10);

      const result = await listObjects(
        ctx.tenant.organizationId,
        prefix,
        continuationToken,
        maxKeys
      );

      return successResponse(result);
    } catch (error) {
      return errorResponse('S3_LIST_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER', // Read-only users can list
  }
);

// Generate signed URL for upload or download
// Downloads allowed for USER, uploads require READWRITE
export const POST = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const configured = await isS3Configured(ctx.tenant.organizationId);
      if (!configured) {
        return errorResponse('S3_NOT_CONFIGURED', 'S3 is not configured for this organization', 400);
      }

      const body = await request.json() as {
        key: string;
        operation: 'download' | 'upload';
        contentType?: string;
        expiresIn?: number;
      };

      if (!body.key) {
        return errorResponse('INVALID_REQUEST', 'key is required', 400);
      }

      // Validate and sanitize key
      const sanitizedKey = sanitizeS3Key(body.key);
      if (!isValidS3Key(sanitizedKey)) {
        return errorResponse('INVALID_REQUEST', 'Invalid S3 key', 400);
      }

      // Check role for upload operations
      if (body.operation === 'upload') {
        // Uploads require READWRITE or higher
        if (ctx.tenant.userRole === 'USER') {
          return errorResponse('FORBIDDEN', 'Upload requires READWRITE role or higher', 403);
        }
      }

      const method = body.operation === 'upload' ? 'PUT' : 'GET';
      const contentType = body.contentType || getMimeType(sanitizedKey);

      const url = await generateSignedUrl(
        ctx.tenant.organizationId,
        sanitizedKey,
        method,
        {
          expiresIn: body.expiresIn || 3600,
          contentType: method === 'PUT' ? contentType : undefined,
        }
      );

      return successResponse({ 
        url, 
        method,
        contentType,
        expiresIn: body.expiresIn || 3600,
      });
    } catch (error) {
      return errorResponse('S3_SIGNED_URL_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER', // Base role is USER, upload check is inside handler
  }
);

// Delete object - requires ADMIN
export const DELETE = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const configured = await isS3Configured(ctx.tenant.organizationId);
      if (!configured) {
        return errorResponse('S3_NOT_CONFIGURED', 'S3 is not configured for this organization', 400);
      }

      const { searchParams } = new URL(request.url);
      const key = searchParams.get('key');

      if (!key) {
        return errorResponse('INVALID_REQUEST', 'key query parameter is required', 400);
      }

      // Validate and sanitize key
      const sanitizedKey = sanitizeS3Key(key);
      if (!isValidS3Key(sanitizedKey)) {
        return errorResponse('INVALID_REQUEST', 'Invalid S3 key', 400);
      }

      await deleteObject(ctx.tenant.organizationId, sanitizedKey);
      return successResponse({ deleted: sanitizedKey });
    } catch (error) {
      return errorResponse('S3_DELETE_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'bulk', // Deletes are more destructive, use bulk rate limit
    requiredRole: 'ADMIN', // Only admins can delete
  }
);
