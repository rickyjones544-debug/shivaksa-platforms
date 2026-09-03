import { NextRequest } from 'next/server';
import { withAdminAuth, readBody } from '../../../_utils';
import { listMemberships, createMembership, type MembershipInput } from '@/lib/memberships/service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withAdminAuth(request, {
    scope: 'membership',
    action: 'read',
    handler: async (ctx) => listMemberships(ctx, id),
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await readBody<MembershipInput>(request);
  return withAdminAuth(request, {
    scope: 'membership',
    action: 'write',
    handler: async (ctx) => createMembership(ctx, id, body),
  });
}
