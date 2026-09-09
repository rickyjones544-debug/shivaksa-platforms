'use client';

import { useEffect, useState } from 'react';

interface SipAccount {
  id: string;
  username: string;
  domain: string;
  password: string;
  status: string;
  callerId: string | null;
  numbers: string[];
}

export default function VoipSipPage() {
  const [accounts, setAccounts] = useState<SipAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

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
      <h1 className="text-2xl font-semibold">SIP Configuration</h1>

      {accounts.map((account) => (
        <div key={account.id} className="rounded-lg border p-4 space-y-2">
          <div className="text-sm">
            <span className="text-gray-500">Username:</span> {account.username}
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Password:</span>{' '}
            <code className="rounded bg-gray-100 px-2 py-1">
              {showPassword[account.id] ? account.password : '••••••••'}
            </code>
            <button
              type="button"
              onClick={() => setShowPassword((prev) => ({ ...prev, [account.id]: !prev[account.id] }))}
              className="ml-2 text-blue-600 hover:underline"
            >
              {showPassword[account.id] ? 'Hide' : 'Show'}
            </button>
            <button
              type="button"
              onClick={() => copyText(account.password)}
              className="ml-2 text-blue-600 hover:underline"
            >
              Copy
            </button>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Domain:</span> {account.domain}
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Caller ID:</span> {account.callerId || '—'}
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Status:</span> {account.status}
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Numbers:</span> {account.numbers.length ? account.numbers.join(', ') : '—'}
          </div>
        </div>
      ))}

      <section className="rounded-lg border p-4 text-sm text-gray-600">
        <h2 className="font-semibold text-gray-900 mb-2">SIP Client Setup Instructions</h2>
        <ol className="list-decimal list-inside space-y-1">
          <li>Install any SIP client such as Zoiper, Linphone, or MicroSIP.</li>
          <li>Create a new SIP account with the username, password, and domain above.</li>
          <li>Use the displayed Caller ID for outbound calls.</li>
          <li>Place test calls to valid US E.164 numbers (e.g. +15551234567).</li>
        </ol>
      </section>
    </div>
  );
}
