'use client';

import { useEffect, useState } from 'react';

interface Transaction {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  description: string | null;
  reference: string | null;
  createdAt: string;
}

interface Wallet {
  balance: string;
  reserved: string;
  available: string;
  currency: string;
}

interface Service {
  status: string;
  customerRate: string;
  reserveMinutes: number;
  maxCallDurationMinutes: number;
}

function formatCurrency(value: string, digits = 2) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return '$0.00';
  return `$${n.toFixed(digits)}`;
}

function estimatedMinutes(available: string, rate: string) {
  const avail = parseFloat(available);
  const r = parseFloat(rate);
  if (!r || r <= 0) return '0';
  return Math.floor(avail / r).toLocaleString();
}

export default function VoipWalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/voip/wallet', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/voip/wallet/transactions?take=50', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/voip/service', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([walletJson, txJson, serviceJson]) => {
        if (!walletJson.success) throw new Error(walletJson.error);
        if (!txJson.success) throw new Error(txJson.error);
        if (!serviceJson.success) throw new Error(serviceJson.error);
        setWallet(walletJson.data);
        setTransactions(txJson.data || []);
        setService(serviceJson.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Wallet &amp; Billing</h1>

      {service && (
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">Customer Rate</div>
          <div className="text-xl font-bold">{formatCurrency(service.customerRate, 4)}/min</div>
          <div className="mt-2 text-sm text-gray-500">
            Service status: <span className="font-medium text-zinc-800 dark:text-zinc-200">{service.status}</span>
          </div>
        </div>
      )}

      {wallet && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Total Balance</div>
            <div className="text-xl font-bold">{formatCurrency(wallet.balance)}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Reserved</div>
            <div className="text-xl font-bold">{formatCurrency(wallet.reserved)}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Available</div>
            <div className="text-xl font-bold">{formatCurrency(wallet.available)}</div>
            {service && (
              <div className="text-sm text-gray-500 mt-1">
                ~ {estimatedMinutes(wallet.available, service.customerRate)} minutes
              </div>
            )}
          </div>
        </div>
      )}

      {service && service.status !== 'ACTIVE' && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-4 text-amber-800 dark:text-amber-200">
          Your wallet is in a {service.status.toLowerCase().replace('_', ' ')} state. Please contact support or an administrator to add funds.
        </div>
      )}

      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
        <table className="w-full text-sm text-left">
          <thead className="border-b">
            <tr>
              <th className="py-2">Date</th>
              <th className="py-2">Type</th>
              <th className="py-2">Amount</th>
              <th className="py-2">Balance After</th>
              <th className="py-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b">
                <td className="py-2">{new Date(tx.createdAt).toLocaleString()}</td>
                <td className="py-2">{tx.type}</td>
                <td className="py-2">{formatCurrency(tx.amount, 4)}</td>
                <td className="py-2">{formatCurrency(tx.balanceAfter)}</td>
                <td className="py-2">{tx.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && <p className="text-gray-500 mt-4">No transactions yet.</p>}
      </section>

      <div className="text-sm text-gray-500">
        Payment top-up is not yet configured. To add funds, please contact your administrator.
      </div>
    </div>
  );
}
