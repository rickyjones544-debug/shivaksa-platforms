import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withVoipAuth } from '../_utils';
import { toCustomerCallDto } from '@/lib/voip/dto/customer';

function buildWhere(organizationId: string, searchParams: URLSearchParams) {
  const where: Record<string, unknown> = { organizationId };
  const status = searchParams.get('status');
  const direction = searchParams.get('direction');
  const destination = searchParams.get('destination');
  const callerId = searchParams.get('callerId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (status) where.status = status;
  if (direction) where.direction = direction;
  if (destination) where.destination = { contains: destination };
  if (callerId) where.callerId = { contains: callerId };
  if (from || to) {
    where.createdAt = {} as Record<string, Date>;
    if (from) (where.createdAt as Record<string, Date>).gte = new Date(from);
    if (to) (where.createdAt as Record<string, Date>).lte = new Date(to);
  }

  return where;
}

export async function GET(request: NextRequest) {
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'calls',
    handler: async (ctx) => {
      const { searchParams } = new URL(request.url);
      const format = searchParams.get('format');
      const take = Math.min(parseInt(searchParams.get('take') || '100', 10), 500);
      const skip = parseInt(searchParams.get('skip') || '0', 10);
      const where = buildWhere(ctx.organization!.id, searchParams);

      const calls = await prisma.voipCall.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });

      const dtos = calls.map(toCustomerCallDto);

      if (format === 'csv') {
        const headers = [
          'Date',
          'Time',
          'Direction',
          'Caller ID',
          'Destination',
          'Duration (s)',
          'Status',
          'Billed Minutes',
          'Charge',
          'Call Reference',
        ];
        const rows = dtos.map((c) => [
          new Date(c.createdAt).toLocaleDateString(),
          new Date(c.createdAt).toLocaleTimeString(),
          c.direction,
          c.callerId,
          c.destination,
          c.durationSeconds ?? '',
          c.status,
          c.billedMinutes ?? '',
          c.customerCharge ?? '',
          c.id,
        ]);
        const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="cdr.csv"',
          },
        });
      }

      return dtos;
    },
  });
}
