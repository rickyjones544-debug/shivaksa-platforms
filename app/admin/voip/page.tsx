'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  slug: string;
  status: string;
  service: {
    status: string;
    customerRate: string;
    reserveMinutes: number;
  } | null;
  wallet: {
    balance: string;
    reserved: string;
    available: string;
  } | null;
  counts: {
    sipAccounts: number;
    phoneNumbers: number;
    voipCalls: number;
  };
}

export default function VoipAdminPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/voip/admin/customers', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error);
        setCustomers(json.data || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">VoIP Admin — Customers</h1>

      <table className="w-full text-sm text-left">
        <thead className="border-b">
          <tr>
            <th className="py-2">Organization</th>
            <th className="py-2">Status</th>
            <th className="py-2">Rate</th>
            <th className="py-2">Available</th>
            <th className="py-2">SIP / Numbers / Calls</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id} className="border-b">
              <td className="py-2">{customer.name}</td>
              <td className="py-2">{customer.service?.status || '—'}</td>
              <td className="py-2">${parseFloat(customer.service?.customerRate || '0').toFixed(4)}/min</td>
              <td className="py-2">${parseFloat(customer.wallet?.available || '0').toFixed(2)}</td>
              <td className="py-2">
                {customer.counts.sipAccounts} / {customer.counts.phoneNumbers} / {customer.counts.voipCalls}
              </td>
              <td className="py-2">
                <Link href={`/admin/voip/customers/${customer.id}`} className="text-blue-600 hover:underline">
                  Manage
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
