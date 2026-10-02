import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { toCustomerCallDto } from '@/lib/voip/dto/customer';
import { CallStatus } from '@/lib/voip/constants';

const PAGE_SIZE = 50;
const ACTIVE_STATUSES = [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ANSWERED];

interface CdrPageProps {
  searchParams: Promise<{
    status?: string;
    direction?: string;
    destination?: string;
    callerId?: string;
    answered?: string;
    minDuration?: string;
    maxDuration?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

function buildQuery(params: Record<string, string | undefined>, extra: Record<string, string>) {
  const merged = { ...params, ...extra };
  return Object.entries(merged)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
}

export default async function VoipCdrPage({ searchParams }: CdrPageProps) {
  const ctx = await getCurrentUser();
  if (!ctx?.organization) {
    redirect('/login');
  }

  const params = await searchParams;
  const page = Math.max(parseInt(params.page || '1', 10) || 1, 1);

  const where: Record<string, unknown> = { organizationId: ctx.organization.id };
  if (params.answered === 'true') where.status = CallStatus.COMPLETED;
  else if (params.answered === 'false') where.status = { notIn: [...ACTIVE_STATUSES, CallStatus.COMPLETED] };
  else if (params.status) where.status = params.status;
  if (params.direction) where.direction = params.direction;
  if (params.destination) where.destination = { contains: params.destination };
  if (params.callerId) where.callerId = { contains: params.callerId };
  const minDuration = parseInt(params.minDuration || '', 10);
  const maxDuration = parseInt(params.maxDuration || '', 10);
  if (Number.isInteger(minDuration) || Number.isInteger(maxDuration)) {
    where.durationSeconds = {} as Record<string, number>;
    if (Number.isInteger(minDuration)) (where.durationSeconds as Record<string, number>).gte = minDuration;
    if (Number.isInteger(maxDuration)) (where.durationSeconds as Record<string, number>).lte = maxDuration;
  }
  if (params.from || params.to) {
    where.createdAt = {} as Record<string, Date>;
    if (params.from) (where.createdAt as Record<string, Date>).gte = new Date(params.from);
    if (params.to) (where.createdAt as Record<string, Date>).lte = new Date(params.to);
  }

  const [calls, total] = await Promise.all([
    prisma.voipCall.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.voipCall.count({ where }),
  ]);

  const dtos = calls.map(toCustomerCallDto);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const csvLink = `/api/voip/cdr?format=csv&take=500&${buildQuery(params, {})}`;
  const pageLink = (p: number) => `/voip/cdr?${buildQuery(params, { page: String(p) })}`;

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Call Detail Records
            </h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              Search and export your organization&apos;s call history.
            </p>
          </div>
          <Link
            href={csvLink}
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            Export CSV
          </Link>
        </div>

        <form className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={params.answered === 'true' ? 'COMPLETED' : params.status || ''}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All</option>
                <option value="COMPLETED">Answered</option>
                <option value="FAILED">Failed</option>
                <option value="BUSY">Busy</option>
                <option value="NO_ANSWER">No answer</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div>
              <label htmlFor="direction" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Direction
              </label>
              <select
                id="direction"
                name="direction"
                defaultValue={params.direction || ''}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All</option>
                <option value="OUTBOUND">Outbound</option>
                <option value="INBOUND">Inbound</option>
              </select>
            </div>
            <div>
              <label htmlFor="destination" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Destination
              </label>
              <input
                id="destination"
                type="text"
                name="destination"
                placeholder="Phone number"
                defaultValue={params.destination || ''}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="callerId" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Caller ID
              </label>
              <input
                id="callerId"
                type="text"
                name="callerId"
                placeholder="Source number"
                defaultValue={params.callerId || ''}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="from" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                From
              </label>
              <input
                id="from"
                type="date"
                name="from"
                defaultValue={params.from || ''}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="to" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                To
              </label>
              <input
                id="to"
                type="date"
                name="to"
                defaultValue={params.to || ''}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="minDuration" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Min duration (s)
              </label>
              <input
                id="minDuration"
                type="number"
                name="minDuration"
                min="0"
                defaultValue={params.minDuration || ''}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="maxDuration" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Max duration (s)
              </label>
              <input
                id="maxDuration"
                type="number"
                name="maxDuration"
                min="0"
                defaultValue={params.maxDuration || ''}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
            >
              Search
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Call history</h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{total} record{total === 1 ? '' : 's'}</span>
          </div>
          <div className="overflow-x-auto -mx-6">
            <table className="w-full min-w-[860px] text-sm text-left">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="pb-3 pl-6 font-medium">Date</th>
                  <th className="pb-3 font-medium">Direction</th>
                  <th className="pb-3 font-medium">Caller ID</th>
                  <th className="pb-3 font-medium">Destination</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Duration</th>
                  <th className="pb-3 font-medium">Billable</th>
                  <th className="pb-3 font-medium">Rate</th>
                  <th className="pb-3 pr-6 font-medium text-right">Charge</th>
                </tr>
              </thead>
              <tbody>
                {dtos.map((call) => (
                  <tr key={call.id} className="border-b border-zinc-100 dark:border-zinc-900 last:border-0">
                    <td className="py-3 pl-6">{new Date(call.createdAt).toLocaleString()}</td>
                    <td className="py-3">{call.direction}</td>
                    <td className="py-3">{call.callerId}</td>
                    <td className="py-3">{call.destination}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {call.status}
                      </span>
                    </td>
                    <td className="py-3">{call.durationSeconds ?? 0}s</td>
                    <td className="py-3">{call.billableSeconds ?? '—'}</td>
                    <td className="py-3">${parseFloat(call.customerRate).toFixed(4)}</td>
                    <td className="py-3 pr-6 text-right">{call.customerCharge ? `$${parseFloat(call.customerCharge).toFixed(4)}` : '—'}</td>
                  </tr>
                ))}
                {dtos.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 pl-6 text-center text-zinc-500 dark:text-zinc-400">
                      No calls match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-zinc-200 dark:border-zinc-800">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={pageLink(page - 1)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={pageLink(page + 1)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
