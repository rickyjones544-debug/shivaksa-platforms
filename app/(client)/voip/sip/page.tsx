'use client';

import { useEffect, useState } from 'react';

interface SipAccount {
  id: string;
  username: string;
  domain: string;
  server: string;
  port: number;
  transport: string;
  status: string;
  callerId: string | null;
  maxConcurrentCalls: number;
  provisioningState: string;
  registrationStatus: string;
  lastRegisteredAt: string | null;
  numbers: string[];
}

function StatusPill({ label, tone }: { label: string; tone: 'green' | 'red' | 'amber' | 'zinc' }) {
  const tones: Record<string, string> = {
    green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    zinc: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {label}
    </span>
  );
}

function registrationTone(status: string): { label: string; tone: 'green' | 'red' | 'amber' | 'zinc' } {
  switch (status) {
    case 'REGISTERED':
      return { label: 'Registered', tone: 'green' };
    case 'UNREGISTERED':
      return { label: 'Not Registered', tone: 'amber' };
    default:
      return { label: 'Unknown', tone: 'zinc' };
  }
}

function provisioningTone(state: string): { label: string; tone: 'green' | 'red' | 'amber' | 'zinc' } {
  switch (state) {
    case 'PROVISIONED':
      return { label: 'Active on gateway', tone: 'green' };
    case 'FAILED':
      return { label: 'Provisioning error — contact support', tone: 'red' };
    default:
      return { label: 'Provisioning in progress', tone: 'amber' };
  }
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wide">{label}</div>
      <div className={`font-medium text-zinc-900 dark:text-zinc-50 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

export default function VoipSipPage() {
  const [accounts, setAccounts] = useState<SipAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    return fetch('/api/voip/sip', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error);
        setAccounts(json.data || []);
      });
  }

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function revealPassword(account: SipAccount) {
    setBusy(account.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/voip/sip/${account.id}/password`, { credentials: 'include' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to reveal password');
      setRevealed((prev) => ({ ...prev, [account.id]: json.data.password }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reveal password');
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword(account: SipAccount) {
    if (!confirm('Reset the SIP password? The current password will stop working immediately.')) return;
    setBusy(account.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/voip/sip/${account.id}`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to reset password');
      setRevealed((prev) => ({ ...prev, [account.id]: json.data.password }));
      setNotice('Password reset. Update your SIP client with the new password.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setBusy(null);
    }
  }

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

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            SIP Configuration
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Connect your softphone or PBX to Shivaksa. You only ever connect to us — we handle the upstream carrier for you.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-500">
            {notice}
          </div>
        )}

        {accounts.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400">No SIP accounts configured.</p>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => {
              const reg = registrationTone(account.registrationStatus);
              const prov = provisioningTone(account.provisioningState);
              const password = revealed[account.id];
              return (
                <div
                  key={account.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill label={account.status === 'ACTIVE' ? 'Enabled' : 'Disabled'} tone={account.status === 'ACTIVE' ? 'green' : 'red'} />
                    <StatusPill label={reg.label} tone={reg.tone} />
                    <StatusPill label={prov.label} tone={prov.tone} />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                    <Field label="SIP Server" value={account.server} mono />
                    <Field label="Port" value={String(account.port)} mono />
                    <Field label="Transport" value={account.transport} mono />
                    <Field label="Username" value={account.username} mono />
                    <div>
                      <div className="text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wide">Password</div>
                      <div className="font-medium font-mono text-zinc-900 dark:text-zinc-50">
                        {password || '••••••••••••'}
                      </div>
                    </div>
                    <Field label="Caller ID" value={account.callerId || '—'} mono />
                    <Field label="Concurrent Calls" value={String(account.maxConcurrentCalls)} />
                    <Field
                      label="Last Registered"
                      value={account.lastRegisteredAt ? new Date(account.lastRegisteredAt).toLocaleString() : '—'}
                    />
                    <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                      <Field
                        label="Assigned Numbers"
                        value={account.numbers.length ? account.numbers.join(', ') : '—'}
                        mono
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      onClick={() => revealPassword(account)}
                      disabled={busy === account.id}
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50"
                    >
                      {password ? 'Password shown' : 'Show password'}
                    </button>
                    <button
                      onClick={() => resetPassword(account)}
                      disabled={busy === account.id}
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 transition disabled:opacity-50"
                    >
                      Reset password
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-blue-50/50 dark:bg-blue-950/20 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">SIP Client Setup</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <li>Install a SIP client such as Zoiper, Linphone, or MicroSIP (any standard SIP phone works).</li>
            <li>
              Configure a SIP account with the server, port, transport, username, and password shown above.
              For Zoiper, enter <span className="font-mono">username@server</span> in the account field and
              enable UDP transport.
            </li>
            <li>Wait for the Registration indicator above to show <span className="font-medium">Registered</span>.</li>
            <li>Place calls using the full E.164 number (e.g. +15551234567). Your approved Caller ID is applied automatically.</li>
          </ol>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            You connect only to Shivaksa. No upstream carrier configuration is required and nothing changes
            on your side if our carrier partners change.
          </p>
        </section>
      </div>
    </div>
  );
}
