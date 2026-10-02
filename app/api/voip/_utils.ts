import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, type AuthenticatedContext } from '@/lib/auth/auth';
import { hasPermission, belongsToOrganization, isPlatformOperator } from '@/lib/rbac/authorization';

/**
 * Handlers may return a raw Response (e.g. a CSV download). Raw responses are
 * passed through untouched instead of being wrapped in the JSON envelope.
 */
function isRawResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export async function withVoipAuth<T>(
  request: NextRequest,
  options: {
    scope: string;
    action: string;
    resource?: string;
    handler: (ctx: AuthenticatedContext) => Promise<T | NextResponse>;
  }
): Promise<NextResponse | Response> {
  try {
    const ctx = await getCurrentUser();
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!ctx.organization) {
      return NextResponse.json({ success: false, error: 'No active organization' }, { status: 403 });
    }

    if (!hasPermission(ctx, options.scope, options.action, options.resource)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const result = await options.handler(ctx);
    if (isRawResponse(result)) return result;
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred';
    console.error(`VoIP API error [${options.scope}:${options.action}]:`, error);
    const status = message === 'Not found' ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function withVoipAdminAuth<T>(
  request: NextRequest,
  options: {
    scope: string;
    action: string;
    resource?: string;
    targetOrganizationId?: string;
    /**
     * When true, only platform operators (SUPER_ADMIN or roles holding
     * platform-level 'admin:*' permissions) may call this endpoint.
     * Client/org admins are rejected even for their own organization.
     * Required for money movement, pricing, suspension and cross-tenant views.
     */
    platformOnly?: boolean;
    handler: (ctx: AuthenticatedContext) => Promise<T | NextResponse>;
  }
): Promise<NextResponse | Response> {
  try {
    const ctx = await getCurrentUser();
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx, options.scope, options.action, options.resource)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (options.platformOnly && !isPlatformOperator(ctx)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (options.targetOrganizationId && !belongsToOrganization(ctx, options.targetOrganizationId)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const result = await options.handler(ctx);
    if (isRawResponse(result)) return result;
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred';
    console.error(`VoIP admin API error [${options.scope}:${options.action}]:`, error);
    const status = message === 'Not found' ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function readBody<T = unknown>(request: NextRequest): Promise<T> {
  return request.json() as Promise<T>;
}
