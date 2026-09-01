import { NextRequest } from 'next/server';
import { withCrmAuth, readBody } from '../../_utils';
import { getCampaign, updateCampaign, deleteCampaign, type CampaignInput } from '@/lib/crm/campaigns';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'read',
    resource: 'campaigns',
    handler: async (ctx) => getCampaign(ctx, id),
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await readBody<Partial<CampaignInput>>(request);
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'write',
    resource: 'campaigns',
    handler: async (ctx) => updateCampaign(ctx, id, body),
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'delete',
    resource: 'campaigns',
    handler: async (ctx) => deleteCampaign(ctx, id),
  });
}
