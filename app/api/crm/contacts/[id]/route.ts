import { NextRequest } from 'next/server';
import { withCrmAuth, readBody } from '../../_utils';
import { getContact, updateContact, deleteContact, type ContactInput } from '@/lib/crm/contacts';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'read',
    resource: 'contacts',
    handler: async (ctx) => getContact(ctx, id),
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await readBody<Partial<ContactInput>>(request);
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'write',
    resource: 'contacts',
    handler: async (ctx) => updateContact(ctx, id, body),
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'delete',
    resource: 'contacts',
    handler: async (ctx) => deleteContact(ctx, id),
  });
}
