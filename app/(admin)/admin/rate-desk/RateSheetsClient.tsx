'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface ProviderOption {
  id: string;
  companyName: string;
  lifecycleStage: string;
  status: string;
}

interface RateCardOption {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface SheetListItem {
  id: string;
  label: string;
  source: string;
  status: string;
  currentVersion: number | null;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  provider: { id: string; companyName: string; lifecycleStage: string };
  versions: { id: string; version: number; status: string; publishedAt: string | null }[];
}

const SOURCES = ['MANUAL', 'EMAIL', 'SUBMISSION', 'SUBMISSION_DOCUMENT', 'API'] as const;

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    RECEIVED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    SUPERSEDED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    ARCHIVED: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${classes[status] ?? classes.ARCHIVED}`}>
      {status}
    </span>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function RateSheetsClient({ canWrite }: { canWrite: boolean }) {
  const [sheets, setSheets] = useState<SheetListItem[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [label, setLabel] = useState('');
  const [source, setSource] = useState<string>('MANUAL');
  const [receivedAt, setReceivedAt] = useState('');
  const [rateCards, setRateCards] = useState<RateCardOption[]>([]);
  const [sourceDocumentId, setSourceDocumentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Pure fetcher — no state writes; callers apply results so that setState
  // only ever runs inside callbacks, never synchronously in an effect body.
  const fetchAll = useCallback(async (): Promise<{
    sheets: SheetListItem[];
    providers: ProviderOption[];
    error: string | null;
  }> => {
    try {
      const [sheetsRes, providersRes] = await Promise.all([
        fetch('/api/admin/rate-desk/sheets'),
        fetch('/api/admin/rate-desk/providers'),
      ]);
      const sheetsJson = await sheetsRes.json();
      const providersJson = await providersRes.json();
      if (!sheetsRes.ok) throw new Error(sheetsJson.error || 'Failed to load rate sheets');
      return {
        sheets: sheetsJson.data ?? [],
        providers: providersRes.ok ? providersJson.data ?? [] : [],
        error: null,
      };
    } catch (e) {
      return {
        sheets: [],
        providers: [],
        error: e instanceof Error ? e.message : 'Failed to load',
      };
    }
  }, []);

  const refresh = useCallback(() => {
    void fetchAll().then((r) => {
      if (r.error) {
        setError(r.error);
      } else {
        setSheets(r.sheets);
        setProviders(r.providers);
        setError(null);
      }
      setLoading(false);
    });
  }, [fetchAll]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (source !== 'SUBMISSION_DOCUMENT' || !providerId) return;
    let cancelled = false;
    void fetch(`/api/admin/rate-desk/providers/${providerId}/rate-cards`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setRateCards(j.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setRateCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [source, providerId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/admin/rate-desk/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          label,
          source,
          receivedAt: receivedAt || undefined,
          sourceDocumentId: sourceDocumentId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create rate sheet');
      setShowCreate(false);
      setProviderId('');
      setLabel('');
      setSource('MANUAL');
      setReceivedAt('');
      setSourceDocumentId('');
      refresh();
    } catch (e2) {
      setFormError(e2 instanceof Error ? e2.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Rate Desk</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Internal provider rate sheets — upstream commercial rates only. Publishing a sheet does
            not activate routing.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/rate-desk/compare"
            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Compare
          </Link>
          <Link
            href="/admin/rate-desk/history"
            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            History
          </Link>
          {canWrite && (
            <button
              type="button"
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
            >
              {showCreate ? 'Cancel' : 'New Rate Sheet'}
            </button>
          )}
        </div>
      </div>

      {showCreate && canWrite && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4"
        >
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">New Rate Sheet</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rd-provider" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Provider
              </label>
              <select
                id="rd-provider"
                required
                value={providerId}
                onChange={(e) => {
                  setProviderId(e.target.value);
                  setRateCards([]);
                  setSourceDocumentId('');
                }}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="">Select a provider…</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rd-label" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Label
              </label>
              <input
                id="rd-label"
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Q3 2026 rate card"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="rd-source" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Source
              </label>
              <select
                id="rd-source"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setRateCards([]);
                  setSourceDocumentId('');
                }}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rd-received" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Received date
              </label>
              <input
                id="rd-received"
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            {source === 'SUBMISSION_DOCUMENT' && (
              <div className="sm:col-span-2">
                <label htmlFor="rd-doc" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Rate card document
                </label>
                <select
                  id="rd-doc"
                  required
                  value={sourceDocumentId}
                  onChange={(e) => setSourceDocumentId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                >
                  <option value="">Select a rate card…</option>
                  {rateCards.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.originalFileName} ({Math.round(d.sizeBytes / 1024)} KB)
                    </option>
                  ))}
                </select>
                {providerId && rateCards.length === 0 && (
                  <p className="mt-1 text-xs text-zinc-500">
                    No rate-card documents are attached to this provider&apos;s submissions.
                  </p>
                )}
              </div>
            )}
          </div>
          {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {submitting ? 'Creating…' : 'Create Rate Sheet'}
          </button>
        </form>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Label</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Received</th>
              <th className="px-4 py-3 font-medium">Version</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium sr-only">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  Loading…
                </td>
              </tr>
            ) : sheets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No rate sheets yet.
                </td>
              </tr>
            ) : (
              sheets.map((sheet) => {
                const published = sheet.versions.find(
                  (v) => v.status === 'PUBLISHED' && v.version === sheet.currentVersion
                );
                return (
                  <tr key={sheet.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {sheet.provider.companyName}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/rate-desk/sheets/${sheet.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {sheet.label}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{sheet.source}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {formatDate(sheet.receivedAt)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {sheet.currentVersion !== null ? `v${sheet.currentVersion}` : '—'}
                      {published ? ' (published)' : ''}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sheet.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/rate-desk/sheets/${sheet.id}`}
                        className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                        aria-label={`Open rate sheet ${sheet.label}`}
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
