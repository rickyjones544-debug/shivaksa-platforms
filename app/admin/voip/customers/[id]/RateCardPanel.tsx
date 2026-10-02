'use client';

import { useEffect, useState } from 'react';

interface AdminRateCard {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  currency: string;
  status: string;
}

interface AdminCustomerRate {
  id: string;
  rateCardId: string;
  prefix: string;
  destination: string | null;
  country: string | null;
  rate: string;
  billingIncrementSeconds: number;
  minimumBillableSeconds: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  enabled: boolean;
}

function Pill({ label, tone }: { label: string; tone: 'green' | 'red' | 'amber' | 'zinc' }) {
  const tones: Record<string, string> = {
    green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    zinc: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {label}
    </span>
  );
}

export default function RateCardPanel({
  customerId,
  onError,
  onMessage,
}: {
  customerId: string;
  onError: (message: string | null) => void;
  onMessage: (message: string | null) => void;
}) {
  const [card, setCard] = useState<AdminRateCard | null>(null);
  const [rates, setRates] = useState<AdminCustomerRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  async function load() {
    const res = await fetch(`/api/voip/admin/customers/${customerId}/rates`, { credentials: 'include' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to load rate card');
    setCard(json.data?.card || null);
    setRates(json.data?.rates || []);
  }

  useEffect(() => {
    load()
      .catch((err) => onError(err instanceof Error ? err.message : 'Failed to load rate card'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function createCard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setCreating(true);
    onError(null);
    onMessage(null);
    try {
      const res = await fetch(`/api/voip/admin/customers/${customerId}/rates`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name')?.toString() || '',
          description: formData.get('description')?.toString() || undefined,
          currency: formData.get('currency')?.toString() || 'USD',
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create rate card');
      onMessage(`Rate card "${json.data.name}" created.`);
      (e.target as HTMLFormElement).reset();
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create rate card');
    } finally {
      setCreating(false);
    }
  }

  async function addRate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!card) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    setBusy('add-rate');
    onError(null);
    onMessage(null);
    try {
      const res = await fetch(`/api/voip/admin/customers/${customerId}/rates/entries`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: card.id,
          prefix: formData.get('prefix')?.toString() || '',
          destination: formData.get('destination')?.toString() || undefined,
          country: formData.get('country')?.toString() || undefined,
          rate: formData.get('rate')?.toString() || '',
          minimumBillableSeconds: parseInt(formData.get('minimumBillableSeconds')?.toString() || '0', 10) || 0,
          billingIncrementSeconds: parseInt(formData.get('billingIncrementSeconds')?.toString() || '60', 10) || 60,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to add rate');
      onMessage(`Rate for +${json.data.prefix} added.`);
      form.reset();
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to add rate');
    } finally {
      setBusy(null);
    }
  }

  async function toggleRate(rate: AdminCustomerRate) {
    setBusy(rate.id);
    onError(null);
    onMessage(null);
    try {
      const res = await fetch(`/api/voip/admin/customers/${customerId}/rates/entries/${rate.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rate.enabled }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Update failed');
      onMessage(`Rate +${rate.prefix} ${rate.enabled ? 'disabled' : 'enabled'}.`);
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  const query = search.trim().toLowerCase();
  const filtered = query
    ? rates.filter(
        (r) =>
          r.prefix.includes(query.replace(/[^\d]/g, '')) ||
          (r.destination || '').toLowerCase().includes(query) ||
          (r.country || '').toLowerCase() === query
      )
    : rates;

  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Customer Rate Card</h2>
        {card && <Pill label={card.status} tone={card.status === 'ACTIVE' ? 'green' : 'red'} />}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : !card ? (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No rate card assigned. Calls will be rejected until a rate card with matching rates exists.
          </p>
          <form onSubmit={createCard} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Name</label>
              <input
                name="name"
                required
                placeholder="Standard rates"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Currency</label>
              <input
                name="currency"
                defaultValue="USD"
                maxLength={3}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create card'}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-medium text-zinc-900 dark:text-white">{card.name}</span>
            <span className="text-zinc-500 dark:text-zinc-400">Currency: {card.currency}</span>
            {card.description && (
              <span className="text-zinc-500 dark:text-zinc-400">{card.description}</span>
            )}
          </div>

          <form onSubmit={addRate} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 items-end rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Prefix</label>
              <input
                name="prefix"
                required
                placeholder="30"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Destination</label>
              <input
                name="destination"
                placeholder="Greece"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Country</label>
              <input
                name="country"
                placeholder="GR"
                maxLength={3}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Rate/min</label>
              <input
                name="rate"
                required
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.019"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Min sec</label>
              <input
                name="minimumBillableSeconds"
                type="number"
                min="0"
                defaultValue={0}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Increment</label>
              <input
                name="billingIncrementSeconds"
                type="number"
                min="1"
                defaultValue={60}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy === 'add-rate'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm disabled:opacity-50"
            >
              Add rate
            </button>
          </form>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search destination or prefix…"
            className="w-full sm:w-72 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
          />

          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {rates.length === 0 ? 'No rates yet — calls will not be authorized.' : 'No rates match the search.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="pb-2 font-medium">Prefix</th>
                    <th className="pb-2 font-medium">Destination</th>
                    <th className="pb-2 font-medium">Rate/min</th>
                    <th className="pb-2 font-medium">Min</th>
                    <th className="pb-2 font-medium">Increment</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                  {filtered.map((rate) => (
                    <tr key={rate.id}>
                      <td className="py-2 font-mono">+{rate.prefix}</td>
                      <td className="py-2">{rate.destination || rate.country || '—'}</td>
                      <td className="py-2">${parseFloat(rate.rate).toFixed(4)}</td>
                      <td className="py-2">{rate.minimumBillableSeconds}s</td>
                      <td className="py-2">{rate.billingIncrementSeconds}s</td>
                      <td className="py-2">
                        <Pill
                          label={rate.enabled ? 'Enabled' : 'Disabled'}
                          tone={rate.enabled ? 'green' : 'zinc'}
                        />
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => toggleRate(rate)}
                          disabled={busy === rate.id}
                          className={`px-3 py-1 text-xs font-medium rounded-lg border transition disabled:opacity-50 ${
                            rate.enabled
                              ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                              : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          {rate.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
