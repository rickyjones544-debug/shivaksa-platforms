import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { toCustomerCallDto } from '@/lib/voip/dto/customer';

interface CdrPageProps {
  searchParams: Promise<{
    status?: string;
    destination?: string;
    from?: string;
    to?: string;
    take?: string;
  }>;
}

export default async function VoipCdrPage({ searchParams }: CdrPageProps) {
  const ctx = await getCurrentUser();
  if (!ctx?.organization) {
    redirect('/login');
  }

  const params = await searchParams;
  const where: Record<string, unknown> = { organizationId: ctx.organization.id };
  if (params.status) where.status = params.status;
  if (params.destination) where.destination = { contains: params.destination };
  if (params.from || params.to) {
    where.createdAt = {} as Record<string, Date>;
    if (params.from) (where.createdAt as Record<string, Date>).gte = new Date(params.from);
    if (params.to) (where.createdAt as Record<string, Date>).lte = new Date(params.to);
  }

  const take = Math.min(parseInt(params.take || '100', 10), 500);
  const calls = await prisma.voipCall.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
  });

  const dtos = calls.map(toCustomerCallDto);

  const csvLink =
    '/api/voip/cdr?format=csv' +
    (params.status ? `&status=${encodeURIComponent(params.status)}` : '') +
    (params.destination ? `&destination=${encodeURIComponent(params.destination)}` : '') +
    (params.from ? `&from=${encodeURIComponent(params.from)}` : '') +
    (params.to ? `&to=${encodeURIComponent(params.to)}` : '');

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Status
              </label>
              <input
                id="status"
                type="text"
                name="status"
                placeholder="e.g. COMPLETED"
                defaultValue={params.status || ''}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
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
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
              >
                Search
              </button>
            </div>
          </div>
        </form>

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Call history</h2>
          <div className="overflow-x-auto -mx-6">
            <table className="w-full min-w-[720px] text-sm text-left">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="pb-3 pl-6 font-medium">Date</th>
                  <th className="pb-3 font-medium">Direction</th>
                  <th className="pb-3 font-medium">Caller ID</th>
                  <th className="pb-3 font-medium">Destination</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Duration</th>
                  <th className="pb-3 font-medium">Billed Min</th>
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
                    <td className="py-3">{call.billedMinutes ?? '—'}</td>
                    <td className="py-3 pr-6 text-right">{call.customerCharge ? `$${parseFloat(call.customerCharge).toFixed(4)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
