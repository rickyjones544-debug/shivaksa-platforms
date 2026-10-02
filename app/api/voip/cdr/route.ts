import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withVoipAuth } from '../_utils';
import { toCustomerCallDto } from '@/lib/voip/dto/customer';
import { CallStatus } from '@/lib/voip/constants';

const ACTIVE_STATUSES = [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ANSWERED];

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildWhere(organizationId: string, searchParams: URLSearchParams) {
  const where: Record<string, unknown> = { organizationId };
  const status = searchParams.get('status');
  const direction = searchParams.get('direction');
  const destination = searchParams.get('destination');
  const callerId = searchParams.get('callerId');
  const answered = searchParams.get('answered');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const minDuration = parseInt(searchParams.get('minDuration') || '', 10);
  const maxDuration = parseInt(searchParams.get('maxDuration') || '', 10);

  if (answered === 'true') where.status = CallStatus.COMPLETED;
  else if (answered === 'false') where.status = { notIn: [...ACTIVE_STATUSES, CallStatus.COMPLETED] };
  else if (status) where.status = status;
  if (direction) where.direction = direction;
  if (destination) where.destination = { contains: destination };
  if (callerId) where.callerId = { contains: callerId };
  if (from || to) {
    where.createdAt = {} as Record<string, Date>;
    if (from) (where.createdAt as Record<string, Date>).gte = new Date(from);
    if (to) (where.createdAt as Record<string, Date>).lte = new Date(to);
  }
  if (Number.isInteger(minDuration) || Number.isInteger(maxDuration)) {
    where.durationSeconds = {} as Record<string, number>;
    if (Number.isInteger(minDuration)) (where.durationSeconds as Record<string, number>).gte = minDuration;
    if (Number.isInteger(maxDuration)) (where.durationSeconds as Record<string, number>).lte = maxDuration;
  }

  return where;
}

/**
 * GET /api/voip/cdr — customer CDR.
 *
 * Organization-scoped, server-side filtered, paginated. `format=csv` returns
 * a raw Response that the auth wrapper passes through untouched. All fields
 * are customer-safe: no wholesale cost, margin, carrier or gateway internals.
 */
export async function GET(request: NextRequest) {
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'calls',
    handler: async (ctx) => {
      const { searchParams } = new URL(request.url);
      const format = searchParams.get('format');
      const take = Math.min(parseInt(searchParams.get('take') || '50', 10), 500);
      const skip = parseInt(searchParams.get('skip') || '0', 10);
      const where = buildWhere(ctx.organization!.id, searchParams);

      const [calls, total] = await Promise.all([
        prisma.voipCall.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        prisma.voipCall.count({ where }),
      ]);

      const dtos = calls.map(toCustomerCallDto);

      if (format === 'csv') {
        const headers = [
          'Date/Time',
          'Source',
          'Destination',
          'Direction',
          'Status',
          'Duration (s)',
          'Billable Seconds',
          'Rate',
          'Charge',
        ];
        const rows = dtos.map((c) => [
          new Date(c.createdAt).toISOString(),
          c.callerId,
          c.destination,
          c.direction,
          c.status,
          c.durationSeconds ?? '',
          c.billableSeconds ?? '',
          c.customerRate,
          c.customerCharge ?? '',
        ]);
        const csv = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="cdr.csv"',
          },
        });
      }

      return { calls: dtos, total, take, skip };
    },
  });
}
