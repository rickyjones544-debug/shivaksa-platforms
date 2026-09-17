'use client';

import { useEffect, useState } from 'react';
import { KycRecordStatus } from '@prisma/client';

const STATUS_LABELS: Record<KycRecordStatus, string> = {
  [KycRecordStatus.DRAFT]: 'Draft',
  [KycRecordStatus.SUBMITTED]: 'Submitted for review',
  [KycRecordStatus.UNDER_REVIEW]: 'Under review',
  [KycRecordStatus.MORE_INFORMATION_REQUIRED]: 'More information required',
  [KycRecordStatus.APPROVED]: 'Approved',
  [KycRecordStatus.REJECTED]: 'Rejected',
  [KycRecordStatus.SUSPENDED]: 'Suspended',
};

const STATUS_COLORS: Record<KycRecordStatus, string> = {
  [KycRecordStatus.DRAFT]: 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900',
  [KycRecordStatus.SUBMITTED]: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40',
  [KycRecordStatus.UNDER_REVIEW]: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40',
  [KycRecordStatus.MORE_INFORMATION_REQUIRED]: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40',
  [KycRecordStatus.APPROVED]: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40',
  [KycRecordStatus.REJECTED]: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40',
  [KycRecordStatus.SUSPENDED]: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40',
};

const INITIAL_FORM = {
  legalBusinessName: '',
  businessType: '',
  country: '',
  stateProvince: '',
  businessRegistrationInfo: '',
  website: '',
  businessDescription: '',
  intendedUseCase: '',
  expectedMonthlyVolume: '',
  expectedDestinations: '',
  callerIdInfo: '',
  contactEmail: '',
  contactPhone: '',
};

const FIELD_LABELS: Record<keyof typeof INITIAL_FORM, string> = {
  legalBusinessName: 'Legal Business Name',
  businessType: 'Business Type',
  country: 'Country',
  stateProvince: 'State / Province',
  businessRegistrationInfo: 'Business Registration Info',
  website: 'Website',
  businessDescription: 'Business Description',
  intendedUseCase: 'Intended Use Case',
  expectedMonthlyVolume: 'Expected Monthly Volume',
  expectedDestinations: 'Expected Destinations',
  callerIdInfo: 'Caller ID Info',
  contactEmail: 'Contact Email',
  contactPhone: 'Contact Phone',
};

export default function CustomerOnboardingPage() {
  const [record, setRecord] = useState<{ status: KycRecordStatus; id?: string; [key: string]: unknown } | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/onboarding', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error);
        setRecord(json.data);
        if (json.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
          setForm({
            ...INITIAL_FORM,
            ...Object.fromEntries(
              Object.entries(json.data).filter(([key]) => key in INITIAL_FORM)
            ) as Record<string, string>,
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const canEdit = record?.status === KycRecordStatus.DRAFT || record?.status === KycRecordStatus.MORE_INFORMATION_REQUIRED;

  async function save(submit = false) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: form, submit }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRecord(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="p-6 sm:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-96 rounded-2xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-6 text-red-700 dark:text-red-300">
            <h2 className="font-semibold mb-1">Error</h2>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Business Onboarding
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Complete your business information below. Submitted details are reviewed before VoIP access is enabled.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <div className="text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Status</div>
          <div className="mt-2">
            {record ? (
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                  STATUS_COLORS[record.status as KycRecordStatus]
                }`}
              >
                {STATUS_LABELS[record.status as KycRecordStatus]}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900">
                Draft
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {Object.entries(INITIAL_FORM).map(([key]) => (
              <div key={key} className={key === 'businessDescription' || key === 'intendedUseCase' ? 'sm:col-span-2' : ''}>
                <label
                  htmlFor={key}
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  {FIELD_LABELS[key as keyof typeof INITIAL_FORM]}
                </label>
                {key === 'businessDescription' || key === 'intendedUseCase' ? (
                  <textarea
                    id={key}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => update(key as keyof typeof form, e.target.value)}
                    disabled={!canEdit}
                    rows={4}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-950 disabled:bg-zinc-100 dark:disabled:bg-zinc-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <input
                    id={key}
                    type="text"
                    value={form[key as keyof typeof form]}
                    onChange={(e) => update(key as keyof typeof form, e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-950 disabled:bg-zinc-100 dark:disabled:bg-zinc-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>
            ))}
          </div>

          {canEdit && (
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => save(false)}
                disabled={saving}
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition"
              >
                {saving ? 'Saving...' : 'Save draft'}
              </button>
              <button
                type="button"
                onClick={() => save(true)}
                disabled={saving}
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? 'Saving...' : 'Submit for review'}
              </button>
            </div>
          )}
        </div>

        {record?.status === KycRecordStatus.MORE_INFORMATION_REQUIRED && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-6 text-amber-700 dark:text-amber-300 text-sm">
            The review team requested more information. Update the required fields and submit again.
          </div>
        )}

        {record?.status === KycRecordStatus.REJECTED && (
          <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-6 text-red-700 dark:text-red-300 text-sm">
            Your onboarding has been rejected. Contact support for next steps.
          </div>
        )}

        {record?.status === KycRecordStatus.APPROVED && (
          <div className="rounded-2xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 p-6 text-green-700 dark:text-green-300 text-sm">
            Your onboarding is approved. You can now access VoIP services.
          </div>
        )}

        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Document attachments are currently recorded as metadata only; secure document storage will be enabled in a later update.
        </p>
      </div>
    </div>
  );
}
