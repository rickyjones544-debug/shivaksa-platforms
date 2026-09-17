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

function statusMessage(status: string) {
  switch (status) {
    case 'LOW_BALANCE':
      return {
        text: 'Your balance is low. Add funds soon to avoid service interruption.',
        color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
      };
    case 'ZERO_BALANCE':
      return {
        text: 'Your balance is depleted. Please add funds to continue calling.',
        color: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900',
      };
    case 'SUSPENDED':
      return {
        text: 'Service is suspended. Contact support for assistance.',
        color: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900',
      };
    default:
      return null;
  }
}

export default function VoipDashboardPage() {
  const [service, setService] = useState<Service | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [accounts, setAccounts] = useState<SipAccount[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            <h2 className="font-semibold mb-1">Unable to load VoIP dashboard</h2>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const status = service ? statusMessage(service.status) : null;

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              VoIP Dashboard
            </h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              Monitor service status, SIP accounts, recent calls and usage.
            </p>
          </div>
          <a
            href="/voip/cdr"
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            View call records
          </a>
        </div>

        {status && (
          <div className={`rounded-2xl border p-4 ${status.color}`}>
            {status.text}
          </div>
        )}

        {service && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Prepaid Available</div>
              <div className="text-3xl font-semibold mt-1">{wallet ? formatCurrency(wallet.available) : '$0.00'}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Total: {wallet ? formatCurrency(wallet.balance) : '$0.00'}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Estimated Minutes</div>
              <div className="text-3xl font-semibold mt-1">
                {wallet && service ? estimatedMinutes(wallet.available, service.customerRate) : '0'}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Based on current rate</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Customer Rate</div>
              <div className="text-3xl font-semibold mt-1">{formatCurrency(service?.customerRate || '0', 4)}/min</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Prepaid per minute</div>
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">SIP Accounts</h2>
          {accounts.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">No SIP accounts configured.</p>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 hover:border-blue-300 dark:hover:border-blue-800 transition"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400">Username:</span>{' '}
                      <span className="font-medium">{account.username}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400">Domain:</span>{' '}
                      <span className="font-medium">{account.domain}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400">Status:</span>{' '}
                      <span className="font-medium">{account.status}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400">Caller ID:</span>{' '}
                      <span className="font-medium">{account.callerId || '—'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Recent Calls</h2>
          {calls.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">No calls yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full min-w-[640px] text-sm text-left">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="pb-3 pl-6 font-medium">Date</th>
                    <th className="pb-3 font-medium">Destination</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Duration</th>
                    <th className="pb-3 pr-6 font-medium text-right">Charge</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-b border-zinc-100 dark:border-zinc-900 last:border-0">
                      <td className="py-3 pl-6">{new Date(call.createdAt).toLocaleString()}</td>
                      <td className="py-3">{call.destination}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {call.status}
                        </span>
                      </td>
                      <td className="py-3">{call.durationSeconds ?? 0}s</td>
                      <td className="py-3 pr-6 text-right">{call.customerCharge ? formatCurrency(call.customerCharge) : '—'}</td>
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
