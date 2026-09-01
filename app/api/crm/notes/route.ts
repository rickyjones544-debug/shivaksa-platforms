import { NextRequest } from 'next/server';
import { withCrmAuth, readBody } from '../_utils';
import { listNotes, createNote, type NoteInput } from '@/lib/crm/notes';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filters = {
    contactId: searchParams.get('contactId') ?? undefined,
    leadId: searchParams.get('leadId') ?? undefined,
    campaignId: searchParams.get('campaignId') ?? undefined,
  };

  return withCrmAuth(request, {
    scope: 'crm',
    action: 'read',
    resource: 'notes',
    handler: async (ctx) => listNotes(ctx, filters),
  });
}

export async function POST(request: NextRequest) {
  const body = await readBody<NoteInput>(request);
  return withCrmAuth(request, {
    scope: 'crm',
    action: 'write',
    resource: 'notes',
    handler: async (ctx) => createNote(ctx, body),
  });
}
