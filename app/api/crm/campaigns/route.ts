import { NextRequest } from 'next/server';
import { withCrmAuth, readBody } from '../_utils';
import { listCampaigns, createCampaign, type CampaignInput } from '@/lib/crm/campaigns';

export async function GET(request: NextRequest) {
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'read',
    resource: 'campaigns',
    handler: async (ctx) => listCampaigns(ctx),
  });
}

export async function POST(request: NextRequest) {
  const body = await readBody<CampaignInput>(request);
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'write',
    resource: 'campaigns',
    handler: async (ctx) => createCampaign(ctx, body),
  });
}
