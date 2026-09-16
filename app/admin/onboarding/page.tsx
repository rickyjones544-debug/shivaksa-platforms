'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

export default function AdminOnboardingListPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [filter, setFilter] = useState<KycRecordStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = filter ? `/api/admin/onboarding?status=${filter}` : '/api/admin/onboarding';
    fetch(url, { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error);
        setRecords(json.data || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filter]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Onboarding Review</h1>
      <div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as KycRecordStatus | '')}
          className="rounded border px-3 py-2"
        >
          <option value="">All</option>
          {Object.values(KycRecordStatus).map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <table className="w-full text-sm text-left border">
        <thead className="border-b">
          <tr>
            <th className="p-3">Organization</th>
            <th className="p-3">Status</th>
            <th className="p-3">Documents</th>
            <th className="p-3">Updated</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-b">
              <td className="p-3">{record.organizationName}</td>
              <td className="p-3">{STATUS_LABELS[record.status as KycRecordStatus]}</td>
              <td className="p-3">{record.documentCount}</td>
              <td className="p-3">{new Date(record.updatedAt).toLocaleString()}</td>
              <td className="p-3">
                <Link href={`/admin/onboarding/${record.organizationId}`} className="text-blue-600 hover:underline">
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
