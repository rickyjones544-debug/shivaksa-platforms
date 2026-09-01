import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { tenantWhere, tenantCreateData, assertTenantOwnership, toDecimalInput } from '@/lib/tenant/db';

export type LeadInput = {
  title: string;
  status?: string;
  value?: string | number | null;
  source?: string;
  contactId?: string | null;
  assignedToId?: string | null;
};

export async function listLeads(ctx: AuthenticatedContext) {
  return prisma.lead.findMany({
    where: tenantWhere(ctx),
    include: { contact: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getLead(ctx: AuthenticatedContext, id: string) {
  const lead = await prisma.lead.findFirst({
    where: tenantWhere(ctx, { id }),
    include: { contact: true },
  });
  assertTenantOwnership(lead, ctx);
  return lead;
}

export async function createLead(ctx: AuthenticatedContext, data: LeadInput) {
  // If a contactId is provided, ensure it belongs to the same tenant.
  if (data.contactId) {
    await verifyContactOwnership(ctx, data.contactId);
  }

  return prisma.lead.create({
    data: tenantCreateData(ctx, {
      title: data.title,
      status: data.status ?? 'NEW',
      value: toDecimalInput(data.value),
      source: data.source,
      contactId: data.contactId ?? null,
      assignedToId: data.assignedToId ?? null,
    }),
  });
}

export async function updateLead(
  ctx: AuthenticatedContext,
  id: string,
  data: Partial<LeadInput>
) {
  const existing = await prisma.lead.findFirst({
    where: tenantWhere(ctx, { id }),
  });
  assertTenantOwnership(existing, ctx);

  if (data.contactId) {
    await verifyContactOwnership(ctx, data.contactId);
  }

  return prisma.lead.update({
    where: { id },
    data: {
      title: data.title,
      status: data.status,
      value: data.value === null ? null : toDecimalInput(data.value),
      source: data.source,
      contactId: data.contactId ?? null,
      assignedToId: data.assignedToId ?? null,
    },
  });
}

export async function deleteLead(ctx: AuthenticatedContext, id: string) {
  const existing = await prisma.lead.findFirst({
    where: tenantWhere(ctx, { id }),
  });
  assertTenantOwnership(existing, ctx);

  return prisma.lead.delete({ where: { id } });
}

async function verifyContactOwnership(ctx: AuthenticatedContext, contactId: string) {
  const contact = await prisma.contact.findFirst({
    where: tenantWhere(ctx, { id: contactId }),
  });
  if (!contact) {
    throw new Error('Contact not found');
  }
}
