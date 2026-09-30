'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface ProviderOption {
  id: string;
  companyName: string;
}

interface HistoryRow {
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

interface HistoryResult {
  rows: HistoryRow[];
  page: number;
  pageSize: number;
  total: number;
}

const inputCls =
  'w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1';
const thCls = 'px-4 py-3 font-medium';
const tdCls = 'px-4 py-3 text-zinc-600 dark:text-zinc-400';
const tdMono = 'px-4 py-3 font-mono text-zinc-900 dark:text-zinc-100';

export default function HistoryClient({
  initialProviderId,
  initialPrefix,
}: {
  initialProviderId: string;
  initialPrefix: string;
}) {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [result, setResult] = useState<HistoryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [providerId, setProviderId] = useState(initialProviderId);
  const [prefix, setPrefix] = useState(initialPrefix);
  const [countryIso, setCountryIso] = useState('');
  const [destination, setDestination] = useState('');
  const [routeType, setRouteType] = useState('');
  const [versionStatus, setVersionStatus] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    void fetch('/api/admin/rate-desk/providers')
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setProviders(j.data as ProviderOption[]);
      })
      .catch(() => {});
  }, []);

  const fetchHistory = useCallback(
    async (
      pageToFetch: number
    ): Promise<{ result: HistoryResult; error: null } | { result: null; error: string }> => {
      try {
        const q = new URLSearchParams();
        if (providerId) q.set('providerId', providerId);
        if (prefix.trim()) q.set('prefix', prefix.trim());
        if (countryIso.trim()) q.set('countryIso', countryIso.trim());
        if (destination.trim()) q.set('destination', destination.trim());
        if (routeType) q.set('routeType', routeType);
        if (versionStatus) q.set('versionStatus', versionStatus);
        if (pageToFetch > 1) q.set('page', String(pageToFetch));
        const res = await fetch(`/api/admin/rate-desk/history?${q.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'History lookup failed');
        return { result: json.data as HistoryResult, error: null };
      } catch (e) {
        return { result: null, error: e instanceof Error ? e.message : 'History lookup failed' };
      }
    },
    [providerId, prefix, countryIso, destination, routeType, versionStatus]
  );

  // Applies a fetch result — all setState calls happen inside this callback.
  const applyResult = useCallback(
    (r: { result: HistoryResult; error: null } | { result: null; error: string }) => {
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
    },
    []
  );

  const runSearch = useCallback(
    (pageToFetch: number) => {
      setLoading(true);
      void fetchHistory(pageToFetch).then(applyResult);
    },
    [fetchHistory, applyResult]
  );

  // Deep-link from the comparison page auto-runs once when prefilled; state is
  // applied only inside the promise callback, not synchronously in the effect.
  useEffect(() => {
    if (initialProviderId || initialPrefix) {
      void fetchHistory(1).then(applyResult);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    runSearch(1);
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
        Provider rate history
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Immutable snapshots from published and superseded versions. Draft rows are not history.
      </p>

      <form
        onSubmit={handleSearch}
        className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="h-provider" className={labelCls}>Provider</label>
            <select id="h-provider" value={providerId}
              onChange={(e) => setProviderId(e.target.value)} className={inputCls}>
              <option value="">All providers</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.companyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="h-prefix" className={labelCls}>Prefix</label>
            <input id="h-prefix" inputMode="numeric" value={prefix}
              onChange={(e) => setPrefix(e.target.value)} placeholder="3069" className={inputCls} />
          </div>
          <div>
            <label htmlFor="h-country" className={labelCls}>Country ISO</label>
            <input id="h-country" maxLength={2} value={countryIso}
              onChange={(e) => setCountryIso(e.target.value)} placeholder="GR" className={inputCls} />
          </div>
          <div>
            <label htmlFor="h-dest" className={labelCls}>Destination contains</label>
            <input id="h-dest" value={destination}
              onChange={(e) => setDestination(e.target.value)} placeholder="Mobile" className={inputCls} />
          </div>
          <div>
            <label htmlFor="h-type" className={labelCls}>Route type</label>
            <select id="h-type" value={routeType}
              onChange={(e) => setRouteType(e.target.value)} className={inputCls}>
              <option value="">Any</option>
              <option value="FIXED">FIXED</option>
              <option value="MOBILE">MOBILE</option>
              <option value="BOTH">BOTH</option>
            </select>
          </div>
          <div>
            <label htmlFor="h-status" className={labelCls}>Version status</label>
            <select id="h-status" value={versionStatus}
              onChange={(e) => setVersionStatus(e.target.value)} className={inputCls}>
              <option value="">Published + superseded + archived</option>
              <option value="PUBLISHED">Published</option>
              <option value="SUPERSEDED">Superseded</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? 'Searching…' : 'Show history'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
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
                  <th className={thCls}>Version</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Country</th>
                  <th className={thCls}>Destination</th>
                  <th className={thCls}>Prefix</th>
                  <th className={thCls}>Type</th>
                  <th className={thCls}>Rate</th>
                  <th className={thCls}>Billing</th>
                  <th className={thCls}>Effective</th>
                  <th className={thCls}>Published</th>
                  <th className={thCls}>Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {result.rows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-zinc-500">
                      No historical snapshots match these filters.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {r.provider.companyName}
                      </td>
                      <td className={tdCls}>
                        <Link
                          href={`/admin/rate-desk/sheets/${r.sheet.id}/versions/${r.version.version}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {r.sheet.label}
                        </Link>
                      </td>
                      <td className={tdCls}>v{r.version.version}</td>
                      <td className={tdCls}>
                        <span
                          className={
                            r.version.status === 'PUBLISHED'
                              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                              : r.version.status === 'SUPERSEDED'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-zinc-500'
                          }
                        >
                          {r.version.status}
                        </span>
                      </td>
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
                        {r.effectiveTo ? ` → ${r.effectiveTo.slice(0, 10)}` : ' → open'}
                      </td>
                      <td className={tdCls}>
                        {r.version.publishedAt ? r.version.publishedAt.slice(0, 10) : '—'}
                      </td>
                      <td className={tdCls}>{r.sheet.source}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-zinc-500">
            <span>
              {result.total} snapshot{result.total === 1 ? '' : 's'} · page {result.page} of{' '}
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
