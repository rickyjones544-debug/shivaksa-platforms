import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { tenantWhere, tenantCreateData, assertTenantOwnership } from '@/lib/tenant/db';

export type CampaignInput = {
  name: string;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
};

function parseDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (isNaN(date.getTime())) throw new Error('Invalid date');
  return date;
}

export async function listCampaigns(ctx: AuthenticatedContext) {
  return prisma.campaign.findMany({
    where: tenantWhere(ctx),
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCampaign(ctx: AuthenticatedContext, id: string) {
  const campaign = await prisma.campaign.findFirst({
    where: tenantWhere(ctx, { id }),
    include: { leads: { include: { lead: true } } },
  });
  assertTenantOwnership(campaign, ctx);
  return campaign;
}

export async function createCampaign(ctx: AuthenticatedContext, data: CampaignInput) {
  return prisma.campaign.create({
    data: tenantCreateData(ctx, {
      name: data.name,
      status: data.status ?? 'DRAFT',
      startDate: parseDate(data.startDate),
      endDate: parseDate(data.endDate),
    }),
  });
}

export async function updateCampaign(
  ctx: AuthenticatedContext,
  id: string,
  data: Partial<CampaignInput>
) {
  const existing = await prisma.campaign.findFirst({
    where: tenantWhere(ctx, { id }),
  });
  assertTenantOwnership(existing, ctx);

  return prisma.campaign.update({
    where: { id },
    data: {
      name: data.name,
      status: data.status,
      startDate: parseDate(data.startDate),
      endDate: parseDate(data.endDate),
    },
  });
}

export async function deleteCampaign(ctx: AuthenticatedContext, id: string) {
  const existing = await prisma.campaign.findFirst({
    where: tenantWhere(ctx, { id }),
  });
  assertTenantOwnership(existing, ctx);

  return prisma.campaign.delete({ where: { id } });
}

export async function addLeadToCampaign(
  ctx: AuthenticatedContext,
  campaignId: string,
  leadId: string
) {
  const campaign = await prisma.campaign.findFirst({
    where: tenantWhere(ctx, { id: campaignId }),
  });
  assertTenantOwnership(campaign, ctx);

  const lead = await prisma.lead.findFirst({
    where: tenantWhere(ctx, { id: leadId }),
  });
  assertTenantOwnership(lead, ctx, 'Lead not found');

  return prisma.campaignLead.create({
    data: {
      campaignId,
      leadId,
      organizationId: ctx.organization!.id,
    },
  });
}

export async function removeLeadFromCampaign(
  ctx: AuthenticatedContext,
  campaignId: string,
  leadId: string
) {
  const join = await prisma.campaignLead.findFirst({
    where: tenantWhere(ctx, { campaignId, leadId }),
  });
  assertTenantOwnership(join, ctx, 'Campaign lead not found');

  return prisma.campaignLead.delete({
    where: { id: join!.id },
  });
}
