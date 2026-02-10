import { withTenantApiHandler, errorResponse } from '@/lib/api';
import { NextResponse } from 'next/server';
import { idSchema } from '@/lib/validations/schemas';

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const id = parts[parts.length - 2] || '';

    const parsed = idSchema.safeParse({ id });
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid scan id', 400);
    }

    const scan = await ctx.db.securityScan.findFirst({
      where: { id, organizationId: ctx.tenant.organizationId },
      select: { id: true, reportText: true, reportJson: true, type: true, target: true, status: true },
    });

    if (!scan) return errorResponse('NOT_FOUND', 'Scan not found', 404);
    if (!scan.reportText && !scan.reportJson) {
      return errorResponse('NOT_READY', 'Scan report not available yet', 409);
    }

    const filenameSafe = `${scan.type.toLowerCase()}-${scan.id}.json`;
    const payload =
      scan.reportJson ? JSON.stringify(scan.reportJson, null, 2) : (scan.reportText as string);

    return new NextResponse(payload, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filenameSafe}"`,
      },
    });
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);

