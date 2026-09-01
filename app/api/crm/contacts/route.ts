import { NextRequest } from 'next/server';
import { withCrmAuth, readBody } from '../_utils';
import { listContacts, createContact, type ContactInput } from '@/lib/crm/contacts';

export async function GET(request: NextRequest) {
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'read',
    resource: 'contacts',
    handler: async (ctx) => listContacts(ctx),
  });
}

export async function POST(request: NextRequest) {
  const body = await readBody<ContactInput>(request);
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'write',
    resource: 'contacts',
    handler: async (ctx) => createContact(ctx, body),
  });
}
