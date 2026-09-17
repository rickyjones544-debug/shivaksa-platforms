'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface CustomerDetail {
  id: string;
  name: string;
  service: {
    status: string;
    customerRate: string;
    reserveMinutes: number;
    maxCallDurationMinutes: number;
  } | null;
  wallet: {
    balance: string;
    reserved: string;
    available: string;
  } | null;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  description: string | null;
  reference: string | null;
  createdAt: string;
}

function formatCurrency(n: number | string) {
  const val = typeof n === 'string' ? parseFloat(n || '0') : n;
  return `$${val.toFixed(2)}`;
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

export default function VoipCustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/voip/admin/customers/${id}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/voip/admin/customers/${id}/wallet/transactions?take=50`, { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([customerJson, txJson]) => {
        if (!customerJson.success) throw new Error(customerJson.error);
        if (!txJson.success) throw new Error(txJson.error);
        setCustomer(customerJson.data);
        setTransactions(txJson.data || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  async function updateService(payload: Record<string, unknown>) {
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/voip/admin/customers/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.success) {
      setCustomer((prev) => (prev ? { ...prev, service: json.data } : prev));
      setMessage('Service settings updated');
    } else {
      setError(json.error || 'Update failed');
    }
  }

  async function addCredit(amount: string) {
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/voip/admin/customers/${id}/wallet/credit`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(amount),
        description: 'Admin credit',
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const json = await res.json();
    if (json.success) {
      setMessage('Credit added');
    } else {
      setError(json.error || 'Failed to add credit');
    }
  }

  async function setSuspension(suspended: boolean) {
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/voip/admin/customers/${id}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspended }),
    });
    const json = await res.json();
    if (json.success) {
      setCustomer((prev) => (prev && prev.service ? { ...prev, service: { ...prev.service, status: json.data.status } } : prev));
      setMessage(suspended ? 'Customer suspended' : 'Customer reactivated');
    } else {
      setError(json.error || 'Failed to update status');
    }
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] p-8 flex items-center justify-center text-slate-400">
        <div className="inline-flex items-center gap-3">
          <span className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Loading customer…
        </div>
      </div>
    );
  }

  if (error && !customer) {
    return (
      <div className="p-6 sm:p-8">
        <div className="max-w-7xl mx-auto rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 sm:p-8">
        <div className="max-w-7xl mx-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-zinc-500 dark:text-zinc-400">
          Customer not found.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">{customer.name}</h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">Manage service, wallet, and account status.</p>
          </div>
          <a
            href={`/api/voip/admin/customers/${id}/cdr?format=csv`}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Download CDR CSV
          </a>
        </div>

        {message && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-400 text-sm">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Service Settings</h2>
            <StatusBadge status={customer.service?.status || '—'} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget as HTMLFormElement;
              const formData = new FormData(form);
              updateService({
                customerRate: formData.get('customerRate')?.toString(),
                reserveMinutes: parseInt(formData.get('reserveMinutes')?.toString() || '5', 10),
                maxCallDurationMinutes: parseInt(formData.get('maxCallDurationMinutes')?.toString() || '60', 10),
              });
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Customer rate ($/min)</label>
              <input
                name="customerRate"
                type="number"
                step="0.001"
                defaultValue={customer.service?.customerRate || '0.016'}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Reserve minutes</label>
              <input
                name="reserveMinutes"
                type="number"
                defaultValue={customer.service?.reserveMinutes || 5}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Max call duration (min)</label>
              <input
                name="maxCallDurationMinutes"
                type="number"
                defaultValue={customer.service?.maxCallDurationMinutes || 60}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-3">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                Update Rate & Limits
              </button>
            </div>
          </form>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSuspension(true)}
              className="px-4 py-2 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/10 transition font-medium"
            >
              Suspend
            </button>
            <button
              onClick={() => setSuspension(false)}
              className="px-4 py-2 border border-emerald-500/30 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition font-medium"
            >
              Reactivate
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Wallet</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Balance</div>
              <div className="text-xl font-semibold text-zinc-900 dark:text-white">{formatCurrency(customer.wallet?.balance || 0)}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Reserved</div>
              <div className="text-xl font-semibold text-zinc-900 dark:text-white">{formatCurrency(customer.wallet?.reserved || 0)}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Available</div>
              <div className="text-xl font-semibold text-zinc-900 dark:text-white">{formatCurrency(customer.wallet?.available || 0)}</div>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget as HTMLFormElement;
              const formData = new FormData(form);
              addCredit(formData.get('amount')?.toString() || '0');
              form.reset();
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              name="amount"
              type="number"
              step="0.01"
              placeholder="Amount"
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
              Add Credit
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Wallet Transactions</h2>
          {transactions.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Date</th>
                    <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Type</th>
                    <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Amount</th>
                    <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Balance After</th>
                    <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{new Date(tx.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{tx.type}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatCurrency(tx.amount)}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatCurrency(tx.balanceAfter)}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{tx.reference || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
