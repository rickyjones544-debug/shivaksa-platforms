'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface ProviderOption {
  id: string;
  companyName: string;
}

interface ComparisonRow {
  id: string;
  provider: { id: string; companyName: string };
  sheet: { id: string; label: string; source: string; receivedAt: string };
  version: { version: number; status: string; publishedAt: string | null };
  destination: string | null;
  countryIso: string | null;
  prefix: string;
  routeType: string;
  rate: string;
  currency: string;
  firstIncrementSeconds: number;
  incrementSeconds: number;
  minimumDurationSeconds: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

interface CompareResult {
  rows: ComparisonRow[];
  page: number;
  pageSize: number;
  total: number;
  mixedCurrencies?: boolean;
}

const inputCls =
  'w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1';
const thCls = 'px-4 py-3 font-medium';
const tdCls = 'px-4 py-3 text-zinc-600 dark:text-zinc-400';
const tdMono = 'px-4 py-3 font-mono text-zinc-900 dark:text-zinc-100';

export default function CompareClient() {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [providerIds, setProviderIds] = useState<string[]>([]);
  const [countryIso, setCountryIso] = useState('');
  const [destination, setDestination] = useState('');
  const [prefix, setPrefix] = useState('');
  const [routeType, setRouteType] = useState('');
  const [currency, setCurrency] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [sortByRate, setSortByRate] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    void fetch('/api/admin/rate-desk/providers')
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setProviders(j.data as ProviderOption[]);
      })
      .catch(() => {});
  }, []);

  const fetchComparison = useCallback(
    async (
      pageToFetch: number
    ): Promise<
      { result: CompareResult; error: null } | { result: null; error: string }
    > => {
      try {
        const q = new URLSearchParams();
        if (providerIds.length) q.set('providerIds', providerIds.join(','));
        if (countryIso.trim()) q.set('countryIso', countryIso.trim());
        if (destination.trim()) q.set('destination', destination.trim());
        if (prefix.trim()) q.set('prefix', prefix.trim());
        if (routeType) q.set('routeType', routeType);
        if (currency.trim()) q.set('currency', currency.trim());
        if (effectiveDate) q.set('effectiveDate', effectiveDate);
        if (sortByRate) q.set('sortBy', 'rate');
        if (pageToFetch > 1) q.set('page', String(pageToFetch));
        const res = await fetch(`/api/admin/rate-desk/compare?${q.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Comparison failed');
        return { result: json.data as CompareResult, error: null };
      } catch (e) {
        return { result: null, error: e instanceof Error ? e.message : 'Comparison failed' };
      }
    },
    [providerIds, countryIso, destination, prefix, routeType, currency, effectiveDate, sortByRate]
  );

  function runSearch(pageToFetch: number) {
    setLoading(true);
    void fetchComparison(pageToFetch).then((r) => {
      if (r.result === null) {
        setError(r.error);
        setResult(null);
      } else {
        setResult(r.result);
        setPage(r.result.page);
        setError(null);
      }
      setLoading(false);
      setSearched(true);
    });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    runSearch(1);
  }

  function toggleProvider(id: string) {
    setProviderIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/admin/rate-desk"
        className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        ← Rate Desk
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Compare approved provider rates
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Shows only the approved commercial snapshot (active sheet + published version). Internal
        wholesale use only — no routing action is implied.
      </p>

      <form
        onSubmit={handleSearch}
        className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="col-span-2">
            <span className={labelCls} id="cmp-providers-label">
              Providers
            </span>
            <div
              role="group"
              aria-labelledby="cmp-providers-label"
              className="flex flex-wrap gap-2"
            >
              {providers.length === 0 && (
                <span className="text-sm text-zinc-500">Loading providers…</span>
              )}
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProvider(p.id)}
                  aria-pressed={providerIds.includes(p.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    providerIds.includes(p.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {p.companyName}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="cmp-prefix" className={labelCls}>Prefix / dialed digits</label>
            <input id="cmp-prefix" inputMode="numeric" value={prefix}
              onChange={(e) => setPrefix(e.target.value)} placeholder="3069" className={inputCls} />
          </div>
          <div>
            <label htmlFor="cmp-country" className={labelCls}>Country ISO</label>
            <input id="cmp-country" maxLength={2} value={countryIso}
              onChange={(e) => setCountryIso(e.target.value)} placeholder="GR" className={inputCls} />
          </div>
          <div>
            <label htmlFor="cmp-dest" className={labelCls}>Destination contains</label>
            <input id="cmp-dest" value={destination}
              onChange={(e) => setDestination(e.target.value)} placeholder="Mobile" className={inputCls} />
          </div>
          <div>
            <label htmlFor="cmp-type" className={labelCls}>Route type</label>
            <select id="cmp-type" value={routeType}
              onChange={(e) => setRouteType(e.target.value)} className={inputCls}>
              <option value="">Any</option>
              <option value="FIXED">FIXED</option>
              <option value="MOBILE">MOBILE</option>
              <option value="BOTH">BOTH</option>
            </select>
          </div>
          <div>
            <label htmlFor="cmp-currency" className={labelCls}>Currency</label>
            <input id="cmp-currency" maxLength={3} value={currency}
              onChange={(e) => setCurrency(e.target.value)} placeholder="USD" className={inputCls} />
          </div>
          <div>
            <label htmlFor="cmp-date" className={labelCls}>Effective on date (optional)</label>
            <input id="cmp-date" type="date" value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" checked={sortByRate}
                onChange={(e) => setSortByRate(e.target.checked)} />
              Sort by rate (lowest first — sort only, not a recommendation)
            </label>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? 'Searching…' : 'Compare'}
          </button>
          <button
            type="button"
            onClick={() => {
              setProviderIds([]);
              setCountryIso('');
              setDestination('');
              setPrefix('');
              setRouteType('');
              setCurrency('');
              setEffectiveDate('');
              setSortByRate(false);
              setPage(1);
              setResult(null);
              setSearched(false);
              setError(null);
            }}
            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Clear
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {result?.mixedCurrencies && (
        <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Rates are displayed in their source currencies. No FX conversion is applied.
        </div>
      )}

      {searched && result && (
        <>
          <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className={thCls}>Provider</th>
                  <th className={thCls}>Sheet</th>
                  <th className={thCls}>Ver</th>
                  <th className={thCls}>Country</th>
                  <th className={thCls}>Destination</th>
                  <th className={thCls}>Prefix</th>
                  <th className={thCls}>Type</th>
                  <th className={thCls}>Rate</th>
                  <th className={thCls}>Billing</th>
                  <th className={thCls}>Effective</th>
                  <th className={thCls}>Status</th>
                  <th className={`${thCls} sr-only`}>History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {result.rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-zinc-500">
                      No approved rates match these filters.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {r.provider.companyName}
                      </td>
                      <td className={tdCls}>{r.sheet.label}</td>
                      <td className={tdCls}>v{r.version.version}</td>
                      <td className={tdCls}>{r.countryIso ?? '—'}</td>
                      <td className={tdCls}>{r.destination ?? '—'}</td>
                      <td className={tdMono}>+{r.prefix}</td>
                      <td className={tdCls}>{r.routeType}</td>
                      <td className={tdMono}>
                        {r.rate} {r.currency}
                      </td>
                      <td className={tdCls}>
                        {r.firstIncrementSeconds}/{r.incrementSeconds}
                        {r.minimumDurationSeconds > 0 ? ` · min ${r.minimumDurationSeconds}s` : ''}
                      </td>
                      <td className={tdCls}>
                        {r.effectiveFrom ? r.effectiveFrom.slice(0, 10) : '—'}
                        {r.effectiveTo ? ` → ${r.effectiveTo.slice(0, 10)}` : ''}
                      </td>
                      <td className={tdCls}>{r.version.status}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/rate-desk/history?providerId=${r.provider.id}&prefix=${encodeURIComponent(r.prefix)}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          History
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-zinc-500">
            <span>
              {result.total} matching row{result.total === 1 ? '' : 's'} · page {result.page} of{' '}
              {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => runSearch(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={loading || page >= totalPages}
                onClick={() => runSearch(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
