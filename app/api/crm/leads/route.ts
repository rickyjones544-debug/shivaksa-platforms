import { NextRequest } from 'next/server';
import { withCrmAuth, readBody } from '../_utils';
import { listLeads, createLead, type LeadInput } from '@/lib/crm/leads';

export async function GET(request: NextRequest) {
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'read',
    resource: 'leads',
    handler: async (ctx) => listLeads(ctx),
  });
}

export async function POST(request: NextRequest) {
  const body = await readBody<LeadInput>(request);
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'write',
    resource: 'leads',
    handler: async (ctx) => createLead(ctx, body),
  });
}
