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

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    LOW_BALANCE: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    ZERO_BALANCE: 'bg-red-500/10 text-red-500 border-red-500/20',
    SUSPENDED: 'bg-red-500/10 text-red-500 border-red-500/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes[status] || 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}`}>
      {status}
    </span>
  );
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

  if (loading) {
    return (
      <div className="min-h-[50vh] p-8 flex items-center justify-center text-slate-400">
        <div className="inline-flex items-center gap-3">
          <span className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Loading customers…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 sm:p-8">
        <div className="max-w-7xl mx-auto rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">VoIP Customers</h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">Manage customer VoIP services, wallets, and configuration.</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Back to admin
          </Link>
        </div>

        {customers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-zinc-500 dark:text-zinc-400">
            <p className="text-lg font-medium text-zinc-900 dark:text-white mb-1">No customers yet</p>
            <p className="text-sm">Customers with VoIP services will appear here.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Organization</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Status</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Rate</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Available</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">SIP / Numbers / Calls</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                    <td className="px-4 py-3 text-zinc-900 dark:text-white font-medium">{customer.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={customer.service?.status || '—'} /></td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">${parseFloat(customer.service?.customerRate || '0').toFixed(4)}/min</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">${parseFloat(customer.wallet?.available || '0').toFixed(2)}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {customer.counts.sipAccounts} / {customer.counts.phoneNumbers} / {customer.counts.voipCalls}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/voip/customers/${customer.id}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-500 transition font-medium">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
