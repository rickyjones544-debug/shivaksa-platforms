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

export default function VoipWalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/voip/wallet', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/voip/wallet/transactions?take=50', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([walletJson, txJson]) => {
        if (!walletJson.success) throw new Error(walletJson.error);
        if (!txJson.success) throw new Error(txJson.error);
        setWallet(walletJson.data);
        setTransactions(txJson.data || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Wallet & Ledger</h1>

      {wallet && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Total Balance</div>
            <div className="text-xl font-bold">${parseFloat(wallet.balance).toFixed(2)}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Reserved</div>
            <div className="text-xl font-bold">${parseFloat(wallet.reserved).toFixed(2)}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Available</div>
            <div className="text-xl font-bold">${parseFloat(wallet.available).toFixed(2)}</div>
          </div>
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
                <td className="py-2">${parseFloat(tx.amount).toFixed(4)}</td>
                <td className="py-2">${parseFloat(tx.balanceAfter).toFixed(4)}</td>
                <td className="py-2">{tx.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
