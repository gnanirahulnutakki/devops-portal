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
} from '@/lib/services/s3';

// List objects in S3 bucket
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    try {
      if (!isS3Configured(ctx.tenant.organizationId)) {
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
    requiredRole: 'USER',
  }
);

// Generate signed URL for upload or download
export const POST = withTenantApiHandler(
  async (request, ctx) => {
    try {
      if (!isS3Configured(ctx.tenant.organizationId)) {
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

      const method = body.operation === 'upload' ? 'PUT' : 'GET';
      const contentType = body.contentType || getMimeType(body.key);

      const url = await generateSignedUrl(
        ctx.tenant.organizationId,
        body.key,
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
    requiredRole: 'READWRITE', // Uploads require READWRITE
  }
);

// Delete object
export const DELETE = withTenantApiHandler(
  async (request, ctx) => {
    try {
      if (!isS3Configured(ctx.tenant.organizationId)) {
        return errorResponse('S3_NOT_CONFIGURED', 'S3 is not configured for this organization', 400);
      }

      const { searchParams } = new URL(request.url);
      const key = searchParams.get('key');

      if (!key) {
        return errorResponse('INVALID_REQUEST', 'key query parameter is required', 400);
      }

      await deleteObject(ctx.tenant.organizationId, key);
      return successResponse({ deleted: key });
    } catch (error) {
      return errorResponse('S3_DELETE_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'bulk', // Deletes are more destructive, use bulk rate limit
    requiredRole: 'ADMIN', // Only admins can delete
  }
);
