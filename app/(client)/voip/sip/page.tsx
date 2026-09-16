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
          <li>Create a new SIP account with the username and domain above.</li>
          <li>Use the displayed Caller ID for outbound calls.</li>
          <li>Place test calls to valid US E.164 numbers (e.g. +15551234567).</li>
        </ol>
      </section>
    </div>
  );
}
