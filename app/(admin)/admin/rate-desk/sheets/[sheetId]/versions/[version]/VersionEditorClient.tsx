'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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
  notes: string | null;
}

interface SheetVersion {
  id: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED' | 'ARCHIVED';
  publishedAt: string | null;
  createdAt: string;
  rates: RateRow[];
}

interface SheetDetail {
  id: string;
  label: string;
  status: string;
  currentVersion: number | null;
  provider: { id: string; companyName: string };
  versions: SheetVersion[];
}

interface RowFormState {
  prefix: string;
  countryIso: string;
  destination: string;
  routeType: 'FIXED' | 'MOBILE' | 'BOTH';
  rate: string;
  currency: string;
  firstIncrementSeconds: string;
  incrementSeconds: string;
  minimumDurationSeconds: string;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
}

const EMPTY_FORM: RowFormState = {
  prefix: '',
  countryIso: '',
  destination: '',
  routeType: 'FIXED',
  rate: '',
  currency: 'USD',
  firstIncrementSeconds: '60',
  incrementSeconds: '60',
  minimumDurationSeconds: '0',
  effectiveFrom: '',
  effectiveTo: '',
  notes: '',
};

function rowToForm(row: RateRow): RowFormState {
  return {
    prefix: row.prefix,
    countryIso: row.countryIso ?? '',
    destination: row.destination ?? '',
    routeType: row.routeType,
    rate: String(row.rate),
    currency: row.currency,
    firstIncrementSeconds: String(row.firstIncrementSeconds),
    incrementSeconds: String(row.incrementSeconds),
    minimumDurationSeconds: String(row.minimumDurationSeconds),
    effectiveFrom: row.effectiveFrom ? row.effectiveFrom.slice(0, 10) : '',
    effectiveTo: row.effectiveTo ? row.effectiveTo.slice(0, 10) : '',
    notes: row.notes ?? '',
  };
}

function formToPayload(form: RowFormState) {
  const num = (v: string) => (v === '' ? undefined : Number.parseInt(v, 10));
  return {
    prefix: form.prefix.trim(),
    countryIso: form.countryIso.trim().toUpperCase() || undefined,
    destination: form.destination.trim() || undefined,
    routeType: form.routeType,
    rate: form.rate.trim(),
    currency: form.currency.trim().toUpperCase() || 'USD',
    firstIncrementSeconds: num(form.firstIncrementSeconds),
    incrementSeconds: num(form.incrementSeconds),
    minimumDurationSeconds: num(form.minimumDurationSeconds),
    effectiveFrom: form.effectiveFrom || undefined,
    effectiveTo: form.effectiveTo || undefined,
    notes: form.notes.trim() || undefined,
  };
}

const inputCls =
  'w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1';

export default function VersionEditorClient({
  sheetId,
  version,
  canWrite,
}: {
  sheetId: string;
  version: number;
  canWrite: boolean;
}) {
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [form, setForm] = useState<RowFormState>(EMPTY_FORM);

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

  const ver = useMemo(
    () => sheet?.versions.find((v) => v.version === version) ?? null,
    [sheet, version]
  );
  const editable = canWrite && ver?.status === 'DRAFT';

  function extractError(json: { error?: string; details?: string[] }) {
    setActionError(json.error ?? 'Request failed');
    setDetails(Array.isArray(json.details) ? json.details : []);
  }

  async function saveRow(e: React.FormEvent) {
    e.preventDefault();
    if (!ver) return;
    setBusy(true);
    setActionError(null);
    setDetails([]);
    try {
      const isNew = editing === 'new';
      const url = isNew
        ? `/api/admin/rate-desk/sheets/${sheetId}/versions/${version}/rates`
        : `/api/admin/rate-desk/sheets/${sheetId}/versions/${version}/rates/${editing}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(form)),
      });
      const json = await res.json();
      if (!res.ok) {
        extractError(json);
        return;
      }
      setEditing(null);
      setForm(EMPTY_FORM);
      refresh();
    } catch (e2) {
      setActionError(e2 instanceof Error ? e2.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteRow(rateId: string) {
    if (!window.confirm('Remove this rate row from the draft?')) return;
    setBusy(true);
    setActionError(null);
    setDetails([]);
    try {
      const res = await fetch(
        `/api/admin/rate-desk/sheets/${sheetId}/versions/${version}/rates/${rateId}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!res.ok) {
        extractError(json);
        return;
      }
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Request failed');
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

  if (error || !sheet || !ver) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error ?? 'Version not found'}
        </div>
        <Link href="/admin/rate-desk" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          ← Back to Rate Desk
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href={`/admin/rate-desk/sheets/${sheetId}`}
        className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        ← {sheet.label}
      </Link>

      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Version {ver.version}
            <span className="ml-3 align-middle text-sm font-normal text-zinc-500">
              {sheet.provider.companyName} · {ver.status}
            </span>
          </h1>
          {ver.status !== 'DRAFT' && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              This version is {ver.status.toLowerCase()} and read-only. Publishing a rate sheet is a
              commercial snapshot only — it does not activate routing.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {editable && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditing('new');
                  setForm(EMPTY_FORM);
                }}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
              >
                Add Rate
              </button>
              <Link
                href={`/admin/rate-desk/sheets/${sheetId}/versions/${version}/review`}
                className="px-4 py-2 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
              >
                Review &amp; Publish
              </Link>
            </>
          )}
          {!editable && (
            <Link
              href={`/admin/rate-desk/sheets/${sheetId}/versions/${version}/review`}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Review
            </Link>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mt-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <p>{actionError}</p>
          {details.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {details.slice(0, 10).map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editing && (
        <form
          onSubmit={saveRow}
          className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
        >
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
            {editing === 'new' ? 'Add rate row' : 'Edit rate row'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label htmlFor="rr-prefix" className={labelCls}>Prefix (digits, no +)</label>
              <input id="rr-prefix" required value={form.prefix}
                onChange={(e) => setForm({ ...form, prefix: e.target.value })}
                placeholder="30" className={inputCls} />
            </div>
            <div>
              <label htmlFor="rr-country" className={labelCls}>Country ISO</label>
              <input id="rr-country" value={form.countryIso} maxLength={2}
                onChange={(e) => setForm({ ...form, countryIso: e.target.value })}
                placeholder="GR" className={inputCls} />
            </div>
            <div>
              <label htmlFor="rr-dest" className={labelCls}>Destination</label>
              <input id="rr-dest" value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                placeholder="Greece Mobile" className={inputCls} />
            </div>
            <div>
              <label htmlFor="rr-type" className={labelCls}>Route type</label>
              <select id="rr-type" value={form.routeType}
                onChange={(e) => setForm({ ...form, routeType: e.target.value as RowFormState['routeType'] })}
                className={inputCls}>
                <option value="FIXED">FIXED</option>
                <option value="MOBILE">MOBILE</option>
                <option value="BOTH">BOTH</option>
              </select>
            </div>
            <div>
              <label htmlFor="rr-rate" className={labelCls}>Rate / min</label>
              <input id="rr-rate" required inputMode="decimal" value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                placeholder="0.0186" className={inputCls} />
            </div>
            <div>
              <label htmlFor="rr-currency" className={labelCls}>Currency</label>
              <input id="rr-currency" required maxLength={3} value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                placeholder="USD" className={inputCls} />
            </div>
            <div>
              <label htmlFor="rr-first" className={labelCls}>First increment (s)</label>
              <input id="rr-first" inputMode="numeric" value={form.firstIncrementSeconds}
                onChange={(e) => setForm({ ...form, firstIncrementSeconds: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label htmlFor="rr-inc" className={labelCls}>Increment (s)</label>
              <input id="rr-inc" inputMode="numeric" value={form.incrementSeconds}
                onChange={(e) => setForm({ ...form, incrementSeconds: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label htmlFor="rr-min" className={labelCls}>Minimum duration (s)</label>
              <input id="rr-min" inputMode="numeric" value={form.minimumDurationSeconds}
                onChange={(e) => setForm({ ...form, minimumDurationSeconds: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label htmlFor="rr-eff-from" className={labelCls}>Effective from</label>
              <input id="rr-eff-from" type="date" value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label htmlFor="rr-eff-to" className={labelCls}>Effective to</label>
              <input id="rr-eff-to" type="date" value={form.effectiveTo}
                onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label htmlFor="rr-notes" className={labelCls}>Notes</label>
              <input id="rr-notes" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputCls} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={busy}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
              {busy ? 'Saving…' : 'Save row'}
            </button>
            <button type="button" onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <th className="px-4 py-3 font-medium">Prefix</th>
              <th className="px-4 py-3 font-medium">Destination</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Rate</th>
              <th className="px-4 py-3 font-medium">Billing</th>
              <th className="px-4 py-3 font-medium">Effective</th>
              {editable && <th className="px-4 py-3 font-medium sr-only">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {ver.rates.length === 0 ? (
              <tr>
                <td colSpan={editable ? 7 : 6} className="px-4 py-8 text-center text-zinc-500">
                  No rate rows{editable ? ' — add the first row or publish requires at least one' : ''}.
                </td>
              </tr>
            ) : (
              ver.rates.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-3 font-mono text-zinc-900 dark:text-zinc-100">
                    +{row.prefix}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.destination ?? '—'}
                    {row.countryIso ? ` (${row.countryIso})` : ''}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.routeType}</td>
                  <td className="px-4 py-3 font-mono text-zinc-900 dark:text-zinc-100">
                    {String(row.rate)} {row.currency}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.firstIncrementSeconds}/{row.incrementSeconds}
                    {row.minimumDurationSeconds > 0 ? ` · min ${row.minimumDurationSeconds}s` : ''}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.effectiveFrom.slice(0, 10)}
                    {row.effectiveTo ? ` → ${row.effectiveTo.slice(0, 10)}` : ''}
                  </td>
                  {editable && (
                    <td className="px-4 py-3 text-right space-x-3">
                      <button type="button" disabled={busy}
                        onClick={() => { setEditing(row.id); setForm(rowToForm(row)); }}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
                        Edit
                      </button>
                      <button type="button" disabled={busy} onClick={() => deleteRow(row.id)}
                        className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
