import { NextResponse } from 'next/server';
import { getCurrentUser, type AuthenticatedContext } from '@/lib/auth/auth';
import { hasPermission } from '@/lib/rbac/authorization';
import { RateDeskError } from '@/lib/rate-desk/services/rate-sheets';

const STATUS_BY_CODE: Record<RateDeskError['code'], number> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  STATE: 409,
};

/**
 * Rate Desk route wrapper: session auth + rate-desk RBAC + structured error
 * mapping for the service's typed errors. Mirrors withVoipAdminAuth but maps
 * RateDeskError codes instead of relying on message matching.
 */
export async function withRateDeskAuth<T>(options: {
  action: 'read' | 'write' | 'delete';
  handler: (ctx: AuthenticatedContext) => Promise<T>;
}): Promise<NextResponse> {
  const ctx = await getCurrentUser();
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!ctx.organization) {
    return NextResponse.json({ success: false, error: 'No active organization' }, { status: 403 });
  }
  if (!hasPermission(ctx, 'rate-desk', options.action)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  try {
    const result = await options.handler(ctx);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof RateDeskError) {
      return NextResponse.json(
        { success: false, error: error.message, details: error.details },
        { status: STATUS_BY_CODE[error.code] }
      );
    }
    console.error(`Rate Desk API error [rate-desk:${options.action}]:`, error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}
