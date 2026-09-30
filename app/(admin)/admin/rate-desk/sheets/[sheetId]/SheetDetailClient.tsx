'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface RateRow {
  id: string;
  prefix: string;
  routeType: string;
  rate: string;
  currency: string;
  countryIso: string | null;
  destination: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

interface SheetVersion {
  id: string;
  version: number;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  rates: RateRow[];
}

interface SheetDetail {
  id: string;
  label: string;
  source: string;
  status: string;
  currentVersion: number | null;
  receivedAt: string;
  notes: string | null;
  provider: { id: string; companyName: string; lifecycleStage: string };
  sourceDocument: { id: string; originalFileName: string; category: string; mimeType: string } | null;
  versions: SheetVersion[];
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    PUBLISHED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    RECEIVED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    DRAFT: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border-zinc-400/30',
    SUPERSEDED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    ARCHIVED: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${classes[status] ?? classes.DRAFT}`}>
      {status}
    </span>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SheetDetailClient({
  sheetId,
  canWrite,
}: {
  sheetId: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Pure fetcher — state is applied only inside .then callbacks so no setState
  // runs synchronously in an effect body.
  const fetchSheet = useCallback(async (): Promise<
    { sheet: SheetDetail; error: null } | { sheet: null; error: string }
  > => {
    try {
      const res = await fetch(`/api/admin/rate-desk/sheets/${sheetId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Rate sheet not found');
      return { sheet: json.data as SheetDetail, error: null };
    } catch (e) {
      return { sheet: null, error: e instanceof Error ? e.message : 'Failed to load' };
    }
  }, [sheetId]);

  const refresh = useCallback(() => {
    void fetchSheet().then((r) => {
      if (r.error) {
        setError(r.error);
      } else {
        setSheet(r.sheet);
        setError(null);
      }
      setLoading(false);
    });
  }, [fetchSheet]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleNewVersion() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/rate-desk/sheets/${sheetId}/versions`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create version');
      refresh();
      router.push(`/admin/rate-desk/sheets/${sheetId}/versions/${json.data.version}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to create version');
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (!window.confirm('Archive this rate sheet? Historical versions are preserved.')) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/rate-desk/sheets/${sheetId}/archive`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to archive');
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to archive');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (error || !sheet) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error ?? 'Rate sheet not found'}
        </div>
        <Link href="/admin/rate-desk" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          ← Back to Rate Desk
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/admin/rate-desk" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
        ← Rate Desk
      </Link>

      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {sheet.label}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {sheet.provider.companyName} · {sheet.provider.lifecycleStage}
          </p>
        </div>
        {canWrite && sheet.status !== 'ARCHIVED' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleNewVersion}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              New Version
            </button>
            <button
              type="button"
              onClick={handleArchive}
              disabled={busy}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition"
            >
              Archive
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="mt-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {actionError}
        </div>
      )}

      <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-sm">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
          <dd className="mt-1">
            <StatusBadge status={sheet.status} />
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Source</dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
            {sheet.source}
            {sheet.sourceDocument ? ` — ${sheet.sourceDocument.originalFileName}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Received</dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatDateTime(sheet.receivedAt)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Current version</dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
            {sheet.currentVersion !== null ? `v${sheet.currentVersion}` : '—'}
          </dd>
        </div>
      </dl>

      <h2 className="mt-8 mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">Versions</h2>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <th className="px-4 py-3 font-medium">Version</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Rates</th>
              <th className="px-4 py-3 font-medium">Effective range</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Published</th>
              <th className="px-4 py-3 font-medium sr-only">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sheet.versions.map((v) => {
              const from = v.rates.reduce<Date | null>(
                (min, r) => (min === null || new Date(r.effectiveFrom) < min ? new Date(r.effectiveFrom) : min),
                null
              );
              const to = v.rates.reduce<Date | null>(
                (max, r) => (r.effectiveTo && (max === null || new Date(r.effectiveTo) > max) ? new Date(r.effectiveTo) : max),
                null
              );
              const range = from ? `${formatDateTime(from.toISOString()).split(',')[0]}${to ? ` → ${formatDateTime(to.toISOString()).split(',')[0]}` : ' → open'}` : '—';
              return (
                <tr key={v.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    v{v.version}
                    {v.version === sheet.currentVersion && (
                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">current</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{v.rates.length}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{range}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDateTime(v.createdAt)}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDateTime(v.publishedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/rate-desk/sheets/${sheet.id}/versions/${v.version}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      aria-label={`Open version ${v.version}`}
                    >
                      {v.status === 'DRAFT' && canWrite ? 'Edit →' : 'View →'}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
