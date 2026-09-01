import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { tenantWhere, tenantCreateData, assertTenantOwnership } from '@/lib/tenant/db';

export type NoteInput = {
  content: string;
  contactId?: string | null;
  leadId?: string | null;
  campaignId?: string | null;
};

type ParentRecord = { organizationId: string };

export async function listNotes(ctx: AuthenticatedContext, filters?: { contactId?: string; leadId?: string; campaignId?: string }) {
  return prisma.note.findMany({
    where: tenantWhere(ctx, {
      ...(filters?.contactId ? { contactId: filters.contactId } : {}),
      ...(filters?.leadId ? { leadId: filters.leadId } : {}),
      ...(filters?.campaignId ? { campaignId: filters.campaignId } : {}),
    }),
    orderBy: { createdAt: 'desc' },
  });
}

export async function getNote(ctx: AuthenticatedContext, id: string) {
  const note = await prisma.note.findFirst({
    where: tenantWhere(ctx, { id }),
  });
  assertTenantOwnership(note, ctx);
  return note;
}

export async function createNote(ctx: AuthenticatedContext, data: NoteInput) {
  await verifyNoteParents(ctx, data);

  return prisma.note.create({
    data: tenantCreateData(ctx, {
      content: data.content,
      contactId: data.contactId ?? null,
      leadId: data.leadId ?? null,
      campaignId: data.campaignId ?? null,
    }),
  });
}

export async function updateNote(
  ctx: AuthenticatedContext,
  id: string,
  data: Partial<NoteInput>
) {
  const existing = await prisma.note.findFirst({
    where: tenantWhere(ctx, { id }),
  });
  assertTenantOwnership(existing, ctx);
  await verifyNoteParents(ctx, data);

  return prisma.note.update({
    where: { id },
    data: {
      content: data.content,
      contactId: data.contactId ?? null,
      leadId: data.leadId ?? null,
      campaignId: data.campaignId ?? null,
    },
  });
}

export async function deleteNote(ctx: AuthenticatedContext, id: string) {
  const existing = await prisma.note.findFirst({
    where: tenantWhere(ctx, { id }),
  });
  assertTenantOwnership(existing, ctx);

  return prisma.note.delete({ where: { id } });
}

async function verifyNoteParents(ctx: AuthenticatedContext, data: Partial<NoteInput>) {
  if (data.contactId) {
    const contact = await prisma.contact.findFirst({
      where: tenantWhere(ctx, { id: data.contactId }),
    });
    assertTenantOwnership(contact, ctx, 'Contact not found');
  }
  if (data.leadId) {
    const lead = await prisma.lead.findFirst({
      where: tenantWhere(ctx, { id: data.leadId }),
    });
    assertTenantOwnership(lead, ctx, 'Lead not found');
  }
  if (data.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: tenantWhere(ctx, { id: data.campaignId }),
    });
    assertTenantOwnership(campaign, ctx, 'Campaign not found');
  }
}
