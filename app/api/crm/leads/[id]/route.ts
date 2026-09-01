import { NextRequest } from 'next/server';
import { withCrmAuth, readBody } from '../../_utils';
import { getLead, updateLead, deleteLead, type LeadInput } from '@/lib/crm/leads';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'read',
    resource: 'leads',
    handler: async (ctx) => getLead(ctx, id),
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await readBody<Partial<LeadInput>>(request);
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'write',
    resource: 'leads',
    handler: async (ctx) => updateLead(ctx, id, body),
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'delete',
    resource: 'leads',
    handler: async (ctx) => deleteLead(ctx, id),
  });
}
