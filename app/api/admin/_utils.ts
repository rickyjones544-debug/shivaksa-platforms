import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, type AuthenticatedContext } from '@/lib/auth/auth';
import { hasPermission, isPlatformOperator } from '@/lib/rbac/authorization';

export async function withAdminAuth<T>(
  request: NextRequest,
  options: {
    scope: string;
    action: string;
    resource?: string;
    /**
     * When true, only platform operators (SUPER_ADMIN or roles holding
     * platform-level 'admin:*' permissions) may call this endpoint.
     * Client/org admins are rejected even for their own organization.
     * Required for cross-tenant administration such as creating or
     * suspending organizations.
     */
    platformOnly?: boolean;
    handler: (ctx: AuthenticatedContext) => Promise<T>;
  }
): Promise<NextResponse> {
  try {
    const ctx = await getCurrentUser();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!hasPermission(ctx, options.scope, options.action, options.resource)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (options.platformOnly && !isPlatformOperator(ctx)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const result = await options.handler(ctx);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred';
    console.error(`Admin API error [${options.scope}:${options.action}]:`, error);
    const status = message === 'Not found' || message === 'Organization not found' || message === 'Membership not found' ? 404 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

export async function readBody<T = unknown>(request: NextRequest): Promise<T> {
  return request.json() as Promise<T>;
}
