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

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Business Onboarding</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Complete your business information below. Submitted details are reviewed before VoIP access is enabled.
        Document attachments are currently recorded as metadata only; secure document storage will be enabled in a later update.
      </p>
      <div className="rounded-lg border p-4">
        <div className="text-sm text-gray-500">Status</div>
        <div className="font-medium">{record ? STATUS_LABELS[record.status as KycRecordStatus] : 'Draft'}</div>
      </div>

      <div className="space-y-4">
        {Object.entries(INITIAL_FORM).map(([key]) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 capitalize mb-1">
              {key.replace(/([A-Z])/g, ' $1')}
            </label>
            <input
              type="text"
              value={form[key as keyof typeof form]}
              onChange={(e) => update(key as keyof typeof form, e.target.value)}
              disabled={!canEdit}
              className="w-full rounded border px-3 py-2 disabled:bg-gray-100"
            />
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => save(false)}
            disabled={saving}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Submit for review'}
          </button>
        </div>
      )}

      {record?.status === KycRecordStatus.MORE_INFORMATION_REQUIRED && (
        <p className="text-sm text-amber-600">
          The review team requested more information. Update the required fields and submit again.
        </p>
      )}

      {record?.status === KycRecordStatus.REJECTED && (
        <p className="text-sm text-red-600">
          Your onboarding has been rejected. Contact support for next steps.
        </p>
      )}

      {record?.status === KycRecordStatus.APPROVED && (
        <p className="text-sm text-green-600">
          Your onboarding is approved. You can now access VoIP services.
        </p>
      )}
    </div>
  );
}
