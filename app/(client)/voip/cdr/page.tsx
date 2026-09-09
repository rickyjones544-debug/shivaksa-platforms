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

  const csvLink = `/api/voip/cdr?format=csv` +
    (params.status ? `&status=${encodeURIComponent(params.status)}` : '') +
    (params.destination ? `&destination=${encodeURIComponent(params.destination)}` : '') +
    (params.from ? `&from=${encodeURIComponent(params.from)}` : '') +
    (params.to ? `&to=${encodeURIComponent(params.to)}` : '');

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Call Detail Records</h1>

      <form className="rounded-lg border p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
        <input
          type="text"
          name="status"
          placeholder="Status"
          defaultValue={params.status || ''}
          className="border rounded px-3 py-2"
        />
        <input
          type="text"
          name="destination"
          placeholder="Destination"
          defaultValue={params.destination || ''}
          className="border rounded px-3 py-2"
        />
        <input
          type="date"
          name="from"
          defaultValue={params.from || ''}
          className="border rounded px-3 py-2"
        />
        <input
          type="date"
          name="to"
          defaultValue={params.to || ''}
          className="border rounded px-3 py-2"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Search
          </button>
          <Link
            href={csvLink}
            className="px-4 py-2 border rounded hover:bg-gray-50 inline-flex items-center"
          >
            Export CSV
          </Link>
        </div>
      </form>

      <table className="w-full text-sm text-left">
        <thead className="border-b">
          <tr>
            <th className="py-2">Date</th>
            <th className="py-2">Direction</th>
            <th className="py-2">Caller ID</th>
            <th className="py-2">Destination</th>
            <th className="py-2">Status</th>
            <th className="py-2">Duration</th>
            <th className="py-2">Billed Minutes</th>
            <th className="py-2">Charge</th>
          </tr>
        </thead>
        <tbody>
          {dtos.map((call) => (
            <tr key={call.id} className="border-b">
              <td className="py-2">{new Date(call.createdAt).toLocaleString()}</td>
              <td className="py-2">{call.direction}</td>
              <td className="py-2">{call.callerId}</td>
              <td className="py-2">{call.destination}</td>
              <td className="py-2">{call.status}</td>
              <td className="py-2">{call.durationSeconds ?? 0}s</td>
              <td className="py-2">{call.billedMinutes ?? '—'}</td>
              <td className="py-2">{call.customerCharge ? `$${parseFloat(call.customerCharge).toFixed(4)}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
