import { NextRequest } from 'next/server';
import { withAdminAuth, readBody } from '../../_utils';
import { getOrganization, updateOrganization, type OrganizationInput } from '@/lib/organizations/service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withAdminAuth(request, {
    scope: 'organization',
    action: 'read',
    handler: async (ctx) => getOrganization(ctx, id),
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await readBody<Partial<OrganizationInput>>(request);
  return withAdminAuth(request, {
    scope: 'organization',
    action: 'write',
    handler: async (ctx) => updateOrganization(ctx, id, body),
  });
}
