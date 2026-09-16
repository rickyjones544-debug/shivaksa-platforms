'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { KycRecordStatus } from '@prisma/client';

const STATUS_LABELS: Record<KycRecordStatus, string> = {
  [KycRecordStatus.DRAFT]: 'Draft',
  [KycRecordStatus.SUBMITTED]: 'Submitted',
  [KycRecordStatus.UNDER_REVIEW]: 'Under review',
  [KycRecordStatus.MORE_INFORMATION_REQUIRED]: 'More info required',
  [KycRecordStatus.APPROVED]: 'Approved',
  [KycRecordStatus.REJECTED]: 'Rejected',
  [KycRecordStatus.SUSPENDED]: 'Suspended',
};

export default function AdminOnboardingDetailPage() {
  const params = useParams<{ id: string }>();
  const [record, setRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/onboarding/${params.id}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error);
        setRecord(json.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function review(decision: KycRecordStatus) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/onboarding/${params.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRecord(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!record) return <div className="p-6">Not found</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Review Onboarding</h1>
      <div className="rounded-lg border p-4 space-y-2 text-sm">
        <div>
          <span className="text-gray-500">Status:</span>{' '}
          <span className="font-medium">{STATUS_LABELS[record.status as KycRecordStatus]}</span>
        </div>
        {Object.entries(record).map(([key, value]) => {
          if (['id', 'status', 'documents', 'reviewedBy', 'organization', 'createdAt', 'updatedAt'].includes(key)) return null;
          if (value === null || value === undefined) return null;
          return (
            <div key={key}>
              <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>{' '}
              <span>{String(value)}</span>
            </div>
          );
        })}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reason / additional information</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded border px-3 py-2"
          rows={3}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => review(KycRecordStatus.APPROVED)}
          disabled={submitting}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => review(KycRecordStatus.MORE_INFORMATION_REQUIRED)}
          disabled={submitting}
          className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
        >
          Request more info
        </button>
        <button
          type="button"
          onClick={() => review(KycRecordStatus.REJECTED)}
          disabled={submitting}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => review(KycRecordStatus.SUSPENDED)}
          disabled={submitting}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
        >
          Suspend
        </button>
      </div>
    </div>
  );
}
