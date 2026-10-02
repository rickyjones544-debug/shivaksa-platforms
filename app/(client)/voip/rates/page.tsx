import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/auth';
import { getRateCardWithRates } from '@/lib/voip/services/customer-rates';
import { toCustomerRateDto } from '@/lib/voip/dto/customer';

interface RatesPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function VoipRatesPage({ searchParams }: RatesPageProps) {
  const ctx = await getCurrentUser();
  if (!ctx?.organization) {
    redirect('/login');
  }

  const params = await searchParams;
  const query = (params.q || '').trim().toLowerCase();

  const card = await getRateCardWithRates(ctx.organization.id);
  const active = card && card.status === 'ACTIVE' ? card : null;

  let dtos = active ? active.rates.map(toCustomerRateDto) : [];
  if (query) {
    const digits = query.replace(/[^\d]/g, '');
    dtos = dtos.filter(
      (r) =>
        r.prefix.replace('+', '').includes(digits || '') ||
        (r.destination || '').toLowerCase().includes(query) ||
        (r.country || '').toLowerCase() === query
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Call Rates
            </h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              Your outbound calling rates. All prices are per minute in {active?.currency || 'USD'}.
            </p>
          </div>
        </div>

        <form className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label htmlFor="q" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Search destination or prefix
              </label>
              <input
                id="q"
                type="text"
                name="q"
                placeholder="e.g. Greece or +30"
                defaultValue={params.q || ''}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
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
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {active ? active.name : 'Rate card'}
            </h2>
            {active && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {dtos.length} destination{dtos.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {!active ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              No rate card is assigned to your account yet. Contact support to enable outbound calling rates.
            </p>
          ) : dtos.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">No rates match your search.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full min-w-[640px] text-sm text-left">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="pb-3 pl-6 font-medium">Destination</th>
                    <th className="pb-3 font-medium">Prefix</th>
                    <th className="pb-3 font-medium">Rate/min</th>
                    <th className="pb-3 font-medium">Minimum</th>
                    <th className="pb-3 pr-6 font-medium">Increment</th>
                  </tr>
                </thead>
                <tbody>
                  {dtos.map((rate) => (
                    <tr key={rate.id} className="border-b border-zinc-100 dark:border-zinc-900 last:border-0">
                      <td className="py-3 pl-6">
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {rate.destination || rate.country || rate.prefix}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-zinc-600 dark:text-zinc-400">{rate.prefix}</td>
                      <td className="py-3 font-medium">
                        ${parseFloat(rate.ratePerMinute).toFixed(4)}
                      </td>
                      <td className="py-3 text-zinc-600 dark:text-zinc-400">
                        {rate.minimumBillableSeconds}s
                      </td>
                      <td className="py-3 pr-6 text-zinc-600 dark:text-zinc-400">
                        {rate.billingIncrementSeconds}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
