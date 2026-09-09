'use client';

import { useEffect, useState } from 'react';

interface Wallet {
  balance: string;
  reserved: string;
  available: string;
  currency: string;
}

interface SipAccount {
  id: string;
  username: string;
  domain: string;
  password: string;
  status: string;
  callerId: string | null;
  numbers: string[];
}

interface Call {
  id: string;
  direction: string;
  callerId: string;
  destination: string;
  status: string;
  startTime: string | null;
  durationSeconds: number | null;
  customerCharge: string | null;
  createdAt: string;
}

interface Service {
  status: string;
  customerRate: string;
  reserveMinutes: number;
  maxCallDurationMinutes: number;
}

function formatCurrency(value: string) {
  return `$${parseFloat(value).toFixed(2)}`;
}

function estimatedMinutes(available: string, rate: string) {
  const avail = parseFloat(available);
  const r = parseFloat(rate);
  if (!r || r <= 0) return '0';
  return Math.floor(avail / r).toLocaleString();
}

export default function VoipDashboardPage() {
  const [service, setService] = useState<Service | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [accounts, setAccounts] = useState<SipAccount[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      try {
        const [serviceRes, walletRes, sipRes, callsRes] = await Promise.all([
          fetch('/api/voip/service', { credentials: 'include' }),
          fetch('/api/voip/wallet', { credentials: 'include' }),
          fetch('/api/voip/sip', { credentials: 'include' }),
          fetch('/api/voip/calls?take=5', { credentials: 'include' }),
        ]);

        const results = await Promise.all([
          serviceRes.json(),
          walletRes.json(),
          sipRes.json(),
          callsRes.json(),
        ]);

        if (!serviceRes.ok) throw new Error(results[0].error || 'Failed to load service');
        if (!walletRes.ok) throw new Error(results[1].error || 'Failed to load wallet');
        if (!sipRes.ok) throw new Error(results[2].error || 'Failed to load SIP accounts');
        if (!callsRes.ok) throw new Error(results[3].error || 'Failed to load calls');

        setService(results[0].data);
        setWallet(results[1].data);
        setAccounts(results[2].data || []);
        setCalls(results[3].data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">VoIP Dashboard</h1>

      {service && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Prepaid Balance</div>
            <div className="text-2xl font-bold">{wallet ? formatCurrency(wallet.available) : '$0.00'}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Estimated Minutes</div>
            <div className="text-2xl font-bold">
              {wallet && service ? estimatedMinutes(wallet.available, service.customerRate) : '0'}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Rate</div>
            <div className="text-2xl font-bold">{formatCurrency(service?.customerRate || '0')}/min</div>
          </div>
        </div>
      )}

      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-4">SIP Accounts</h2>
        {accounts.length === 0 ? (
          <p className="text-gray-500">No SIP accounts configured.</p>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div key={account.id} className="border rounded p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Username:</span> {account.username}</div>
                  <div><span className="text-gray-500">Domain:</span> {account.domain}</div>
                  <div><span className="text-gray-500">Status:</span> {account.status}</div>
                  <div><span className="text-gray-500">Caller ID:</span> {account.callerId || '—'}</div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Password:</span>
                  <code className="rounded bg-gray-100 px-2 py-1">
                    {showPassword[account.id] ? account.password : '••••••••'}
                  </code>
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => ({ ...prev, [account.id]: !prev[account.id] }))}
                    className="text-blue-600 hover:underline"
                  >
                    {showPassword[account.id] ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(account.password)}
                    className="text-blue-600 hover:underline"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-4">Recent Calls</h2>
        {calls.length === 0 ? (
          <p className="text-gray-500">No calls yet.</p>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="border-b">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Destination</th>
                <th className="py-2">Status</th>
                <th className="py-2">Duration</th>
                <th className="py-2">Charge</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id} className="border-b">
                  <td className="py-2">{new Date(call.createdAt).toLocaleString()}</td>
                  <td className="py-2">{call.destination}</td>
                  <td className="py-2">{call.status}</td>
                  <td className="py-2">{call.durationSeconds ?? 0}s</td>
                  <td className="py-2">{call.customerCharge ? formatCurrency(call.customerCharge) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
