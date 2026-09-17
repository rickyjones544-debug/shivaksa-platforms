'use client';

import { useEffect, useState } from 'react';

interface SipAccount {
  id: string;
  username: string;
  domain: string;
  status: string;
  callerId: string | null;
  numbers: string[];
}

export default function VoipSipPage() {
  const [accounts, setAccounts] = useState<SipAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/voip/sip', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error);
        setAccounts(json.data || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-32 rounded-2xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 sm:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-6 text-red-700 dark:text-red-300">
            <h2 className="font-semibold mb-1">Unable to load SIP accounts</h2>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            SIP Configuration
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Your SIP account credentials and setup instructions.
          </p>
        </div>

        {accounts.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400">No SIP accounts configured.</p>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wide">Username</div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">{account.username}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wide">Domain</div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">{account.domain}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wide">Status</div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">{account.status}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wide">Caller ID</div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">{account.callerId || '—'}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wide">Numbers</div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">{account.numbers.length ? account.numbers.join(', ') : '—'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-blue-50/50 dark:bg-blue-950/20 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">SIP Client Setup Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <li>Install a SIP client such as Zoiper, Linphone, or MicroSIP.</li>
            <li>Create a new SIP account with the username and domain above.</li>
            <li>Use the displayed Caller ID for outbound calls.</li>
            <li>Place test calls to valid US E.164 numbers (e.g. +15551234567).</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
