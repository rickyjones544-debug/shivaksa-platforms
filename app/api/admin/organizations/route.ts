import { NextRequest } from 'next/server';
import { withAdminAuth, readBody } from '../_utils';
import { listOrganizations, createOrganization, type OrganizationInput } from '@/lib/organizations/service';

export async function GET(request: NextRequest) {
  return withAdminAuth(request, {
    scope: 'admin',
    action: 'read',
    resource: 'organizations',
    handler: async (ctx) => listOrganizations(ctx),
  });
}

export async function POST(request: NextRequest) {
  const body = await readBody<OrganizationInput>(request);
  return withAdminAuth(request, {
    scope: 'admin',
    action: 'write',
    resource: 'organizations',
    handler: async (ctx) => createOrganization(ctx, body),
  });
}
