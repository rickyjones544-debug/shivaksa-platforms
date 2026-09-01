import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { tenantWhere, tenantCreateData, assertTenantOwnership } from '@/lib/tenant/db';

export type ContactInput = {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: string;
};

export async function listContacts(ctx: AuthenticatedContext) {
  return prisma.contact.findMany({
    where: tenantWhere(ctx),
    orderBy: { createdAt: 'desc' },
  });
}

export async function getContact(ctx: AuthenticatedContext, id: string) {
  const contact = await prisma.contact.findFirst({
    where: tenantWhere(ctx, { id }),
  });
  assertTenantOwnership(contact, ctx);
  return contact;
}

export async function createContact(ctx: AuthenticatedContext, data: ContactInput) {
  return prisma.contact.create({
    data: tenantCreateData(ctx, {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      company: data.company,
      status: data.status ?? 'ACTIVE',
    }),
  });
}

export async function updateContact(
  ctx: AuthenticatedContext,
  id: string,
  data: Partial<ContactInput>
) {
  const existing = await prisma.contact.findFirst({
    where: tenantWhere(ctx, { id }),
  });
  assertTenantOwnership(existing, ctx);

  return prisma.contact.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      company: data.company,
      status: data.status,
    },
  });
}

export async function deleteContact(ctx: AuthenticatedContext, id: string) {
  const existing = await prisma.contact.findFirst({
    where: tenantWhere(ctx, { id }),
  });
  assertTenantOwnership(existing, ctx);

  return prisma.contact.delete({ where: { id } });
}
