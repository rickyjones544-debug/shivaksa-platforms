'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface RateRow {
  id: string;
  destination: string | null;
  countryIso: string | null;
  prefix: string;
  routeType: 'FIXED' | 'MOBILE' | 'BOTH';
  rate: string;
  currency: string;
  firstIncrementSeconds: number;
  incrementSeconds: number;
  minimumDurationSeconds: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

interface ReviewData {
  sheet: {
    id: string;
    label: string;
    status: string;
    source: string;
    receivedAt: string;
    createdAt: string;
    currentVersion: number | null;
    provider: { id: string; companyName: string };
  };
  version: {
    version: number;
    status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED' | 'ARCHIVED';
    createdAt: string;
    publishedAt: string | null;
    notes: string | null;
    rates: RateRow[];
  };
  summary: {
    underReview: boolean;
    reviewTask: { id: string; status: string; title: string; assigneeId: string | null; createdAt: string } | null;
    rateCount: number;
    routeTypeCounts: Record<string, number>;
    currencyCounts: Record<string, number>;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    hasOpenEndDate: boolean;
    previousPublished: { version: number; publishedAt: string | null; rateCount: number } | null;
  };
}

const thCls =
  'px-4 py-3 font-medium border-b border-zinc-200 dark:border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400';
const tdCls = 'px-4 py-3 text-zinc-600 dark:text-zinc-400';
const btnPrimary =
  'px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition';
const btnOutline =
  'px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition';
const btnApprove =
  'px-4 py-2 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50 transition';

export default function ReviewClient({
  sheetId,
  version,
  canWrite,
}: {
  sheetId: string;
  version: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchReview = useCallback(async (): Promise<
    { data: ReviewData; error: null } | { data: null; error: string }
  > => {
    try {
      const res = await fetch(
        `/api/admin/rate-desk/sheets/${sheetId}/versions/${version}/review`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load review');
      return { data: json.data as ReviewData, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'Failed to load review' };
    }
  }, [sheetId, version]);

  const refresh = useCallback(() => {
    void fetchReview().then((r) => {
      if (r.error) {
        setError(r.error);
      } else {
        setData(r.data);
        setError(null);
      }
      setLoading(false);
    });
  }, [fetchReview]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function post(path: string, onOk: () => void) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(path, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error || 'Request failed');
        return;
      }
      onOk();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  function submitForReview() {
    void post(`/api/admin/rate-desk/sheets/${sheetId}/versions/${version}/review`, () =>
      refresh()
    );
  }

  function cancelReview() {
    if (!window.confirm('Withdraw this version from review?')) return;
    void post(`/api/admin/rate-desk/sheets/${sheetId}/versions/${version}/review/cancel`, () =>
      refresh()
    );
  }

  function publish() {
    if (
      !window.confirm(
        `Publish version ${version}? This supersedes the current published version and cannot be undone.`
      )
    ) {
      return;
    }
    void post(`/api/admin/rate-desk/sheets/${sheetId}/versions/${version}/publish`, () =>
      refresh()
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error ?? 'Review not found'}
        </div>
        <Link href="/admin/rate-desk" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          ← Back to Rate Desk
        </Link>
      </div>
    );
  }

  const { sheet, version: ver, summary } = data;
  const displayStatus = summary.underReview ? 'UNDER REVIEW' : ver.status;
  const canAct = canWrite && ver.status === 'DRAFT';
  const statusColor = summary.underReview
    ? 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
    : ver.status === 'PUBLISHED'
      ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href={`/admin/rate-desk/sheets/${sheetId}/versions/${version}`}
        className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        ← Version {version} editor
      </Link>

      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Review — {sheet.label} v{ver.version}
            <span className="ml-3 align-middle text-sm font-normal text-zinc-500">
              {sheet.provider.companyName}
            </span>
          </h1>
        </div>
        {canAct && (
          <div className="flex gap-2">
            {!summary.underReview ? (
              <button type="button" onClick={submitForReview} disabled={busy} className={btnPrimary}>
                Submit for Review
              </button>
            ) : (
              <button type="button" onClick={cancelReview} disabled={busy} className={btnOutline}>
                Withdraw from Review
              </button>
            )}
            <button
              type="button"
              onClick={publish}
              disabled={busy || summary.rateCount === 0}
              className={btnApprove}
            >
              Approve &amp; Publish
            </button>
          </div>
        )}
      </div>

      <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${statusColor}`}>
        Status: {displayStatus}
        {summary.reviewTask && ` · review task ${summary.reviewTask.status.toLowerCase().replace('_', ' ')} since ${summary.reviewTask.createdAt.slice(0, 10)}`}
        {ver.status !== 'DRAFT' && ' · this version is read-only'}
      </div>

      {actionError && (
        <div className="mt-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {actionError}
        </div>
      )}

      <section className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Review summary</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Provider</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">{sheet.provider.companyName}</dd>
            <dt className="text-zinc-500">Rate sheet</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">{sheet.label}</dd>
            <dt className="text-zinc-500">Version</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">v{ver.version}</dd>
            <dt className="text-zinc-500">Source</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">{sheet.source}</dd>
            <dt className="text-zinc-500">Received</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">{sheet.receivedAt.slice(0, 10)}</dd>
            <dt className="text-zinc-500">Created</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">{ver.createdAt.slice(0, 10)}</dd>
            <dt className="text-zinc-500">Rate rows</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">{summary.rateCount}</dd>
            <dt className="text-zinc-500">Effective</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">
              {summary.effectiveFrom ? summary.effectiveFrom.slice(0, 10) : '—'}
              {' → '}
              {summary.effectiveTo
                ? summary.effectiveTo.slice(0, 10)
                : summary.hasOpenEndDate
                  ? 'open'
                  : '—'}
            </dd>
          </dl>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Distribution</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Route types</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">
              {(['FIXED', 'MOBILE', 'BOTH'] as const)
                .map((t) => `${t} ${summary.routeTypeCounts[t] ?? 0}`)
                .join(' · ')}
            </dd>
            <dt className="text-zinc-500">Currencies</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">
              {Object.keys(summary.currencyCounts).length === 0
                ? '—'
                : Object.entries(summary.currencyCounts)
                    .map(([c, n]) => `${c} ${n}`)
                    .join(' · ')}
            </dd>
          </dl>
          <h3 className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
            Previous published version
          </h3>
          {summary.previousPublished ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              v{summary.previousPublished.version} · {summary.previousPublished.rateCount} rows
              {summary.previousPublished.publishedAt
                ? ` · published ${summary.previousPublished.publishedAt.slice(0, 10)}`
                : ''}
              {' — '}
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/admin/rate-desk/sheets/${sheetId}/versions/${summary.previousPublished!.version}/review`
                  )
                }
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                open
              </button>
            </p>
          ) : (
            <p className="text-sm text-zinc-500">No previously published version.</p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
        <h2 className="px-4 pt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Destination coverage
        </h2>
        <table className="mt-2 w-full text-sm whitespace-nowrap">
          <thead>
            <tr>
              <th className={thCls}>Country</th>
              <th className={thCls}>Destination</th>
              <th className={thCls}>Prefix</th>
              <th className={thCls}>Type</th>
              <th className={thCls}>Rate</th>
              <th className={thCls}>Billing</th>
              <th className={thCls}>Effective</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {ver.rates.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No rate rows in this version.
                </td>
              </tr>
            ) : (
              ver.rates.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className={tdCls}>{row.countryIso ?? '—'}</td>
                  <td className={tdCls}>{row.destination ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-zinc-900 dark:text-zinc-100">
                    +{row.prefix}
                  </td>
                  <td className={tdCls}>{row.routeType}</td>
                  <td className="px-4 py-3 font-mono text-zinc-900 dark:text-zinc-100">
                    {String(row.rate)} {row.currency}
                  </td>
                  <td className={tdCls}>
                    {row.firstIncrementSeconds}/{row.incrementSeconds}
                    {row.minimumDurationSeconds > 0 ? ` · min ${row.minimumDurationSeconds}s` : ''}
                  </td>
                  <td className={tdCls}>
                    {row.effectiveFrom.slice(0, 10)}
                    {row.effectiveTo ? ` → ${row.effectiveTo.slice(0, 10)}` : ' → open'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Publishing approves this rate sheet as the internal commercial snapshot. It does not
        activate routing, modify carriers, or affect live traffic.
      </p>
    </div>
  );
}
