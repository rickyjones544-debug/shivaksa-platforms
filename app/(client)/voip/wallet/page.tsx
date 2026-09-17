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

  if (loading) {
    return (
      <div className="p-6 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 sm:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-6 text-red-700 dark:text-red-300">
            <h2 className="font-semibold mb-1">Unable to load wallet</h2>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Wallet & Billing
            </h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              Prepaid balance, customer rate and recent transactions.
            </p>
          </div>
          {service && (
            <div className="inline-flex items-center rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Rate: {formatCurrency(service.customerRate, 4)}/min
            </div>
          )}
        </div>

        {service && service.status !== 'ACTIVE' && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 text-amber-700 dark:text-amber-300">
            Your wallet is in a {service.status.toLowerCase().replace(/_/g, ' ')} state. Please contact support or an administrator to add funds.
          </div>
        )}

        {wallet && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Total Balance</div>
              <div className="text-3xl font-semibold mt-1">{formatCurrency(wallet.balance)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Reserved</div>
              <div className="text-3xl font-semibold mt-1">{formatCurrency(wallet.reserved)}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Held for active calls</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Available</div>
              <div className="text-3xl font-semibold mt-1">{formatCurrency(wallet.available)}</div>
              {service && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  ~ {estimatedMinutes(wallet.available, service.customerRate)} minutes
                </div>
              )}
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Recent Transactions</h2>
          {transactions.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full min-w-[480px] text-sm text-left">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="pb-3 pl-6 font-medium">Date</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Balance After</th>
                    <th className="pb-3 pr-6 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-zinc-100 dark:border-zinc-900 last:border-0">
                      <td className="py-3 pl-6">{new Date(tx.createdAt).toLocaleString()}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 font-medium">{formatCurrency(tx.amount, 4)}</td>
                      <td className="py-3">{formatCurrency(tx.balanceAfter)}</td>
                      <td className="py-3 pr-6 text-zinc-500 dark:text-zinc-400">{tx.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Payment top-up</h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
            Payment gateway is not yet configured. To add funds, please contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
