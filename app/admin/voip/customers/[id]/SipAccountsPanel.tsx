'use client';

import { useEffect, useState } from 'react';

interface AdminSipAccount {
  id: string;
  username: string;
  domain: string;
  status: string;
  callerId: string | null;
  maxConcurrentCalls: number;
  transport: string;
  provisioningState: string;
  provisioningError: string | null;
  provisionedAt: string | null;
  asteriskEndpoint: string | null;
  registrationStatus: string;
  lastRegisteredAt: string | null;
  lastContactAddress: string | null;
  registrationUserAgent: string | null;
  numbers: string[];
  createdAt: string;
}

function Pill({ label, tone }: { label: string; tone: 'green' | 'red' | 'amber' | 'zinc' }) {
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

export default function SipAccountsPanel({
  customerId,
  onError,
  onMessage,
}: {
  customerId: string;
  onError: (message: string | null) => void;
  onMessage: (message: string | null) => void;
}) {
  const [accounts, setAccounts] = useState<AdminSipAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch(`/api/voip/admin/customers/${customerId}/sip`, { credentials: 'include' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to load SIP accounts');
    setAccounts(json.data || []);
  }

  useEffect(() => {
    load()
      .catch((err) => onError(err instanceof Error ? err.message : 'Failed to load SIP accounts'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function create() {
    setCreating(true);
    onError(null);
    onMessage(null);
    try {
      const res = await fetch(`/api/voip/admin/customers/${customerId}/sip`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create SIP account');
      if (json.data?.password) {
        setRevealed((prev) => ({ ...prev, [json.data.id]: json.data.password }));
        onMessage(`SIP account created (${json.data.username}). Save the password now — it is shown only once.`);
      } else {
        onMessage('SIP account created');
      }
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create SIP account');
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(account: AdminSipAccount, status: 'ACTIVE' | 'DISABLED') {
    setBusy(account.id);
    onError(null);
    onMessage(null);
    try {
      const res = await fetch(`/api/voip/admin/customers/${customerId}/sip/${account.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Update failed');
      onMessage(status === 'DISABLED' ? 'SIP account disabled' : 'SIP account enabled');
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword(account: AdminSipAccount) {
    if (!confirm(`Reset the SIP password for ${account.username}? The current credential is invalidated.`)) return;
    setBusy(account.id);
    onError(null);
    onMessage(null);
    try {
      const res = await fetch(`/api/voip/admin/customers/${customerId}/sip/${account.id}`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Reset failed');
      if (json.data?.password) {
        setRevealed((prev) => ({ ...prev, [account.id]: json.data.password }));
      }
      onMessage('Password reset — new password shown below (once).');
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setBusy(null);
    }
  }

  async function revealPassword(account: AdminSipAccount) {
    setBusy(account.id);
    onError(null);
    onMessage(null);
    try {
      const res = await fetch(`/api/voip/admin/customers/${customerId}/sip/${account.id}/password`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Reveal failed');
      setRevealed((prev) => ({ ...prev, [account.id]: json.data.password }));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Reveal failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">SIP Accounts</h2>
        <button
          onClick={create}
          disabled={creating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create SIP account'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No SIP accounts yet.</p>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-medium text-zinc-900 dark:text-white">
                  {account.username}
                </span>
                <Pill
                  label={account.status === 'ACTIVE' ? 'Enabled' : 'Disabled'}
                  tone={account.status === 'ACTIVE' ? 'green' : 'red'}
                />
                <Pill
                  label={
                    account.registrationStatus === 'REGISTERED'
                      ? 'Registered'
                      : account.registrationStatus === 'UNREGISTERED'
                        ? 'Not registered'
                        : 'Registration unknown'
                  }
                  tone={
                    account.registrationStatus === 'REGISTERED'
                      ? 'green'
                      : account.registrationStatus === 'UNREGISTERED'
                        ? 'amber'
                        : 'zinc'
                  }
                />
                <Pill
                  label={`Provisioning: ${account.provisioningState}`}
                  tone={
                    account.provisioningState === 'PROVISIONED'
                      ? 'green'
                      : account.provisioningState === 'FAILED'
                        ? 'red'
                        : 'amber'
                  }
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-zinc-500">Caller ID</div>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200">{account.callerId || '—'}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Max concurrent</div>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200">{account.maxConcurrentCalls}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Asterisk endpoint</div>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200">{account.asteriskEndpoint || '—'}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Last registered</div>
                  <div className="text-zinc-800 dark:text-zinc-200">
                    {account.lastRegisteredAt ? new Date(account.lastRegisteredAt).toLocaleString() : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Contact address</div>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200">{account.lastContactAddress || '—'}</div>
                </div>
                <div>
                  <div className="text-zinc-500">User agent</div>
                  <div className="text-zinc-800 dark:text-zinc-200">{account.registrationUserAgent || '—'}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Created</div>
                  <div className="text-zinc-800 dark:text-zinc-200">{new Date(account.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Password</div>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200 break-all">
                    {revealed[account.id] || '••••••••••••'}
                  </div>
                </div>
              </div>

              {account.provisioningError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  Provisioning error: {account.provisioningError}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {account.status === 'ACTIVE' ? (
                  <button
                    onClick={() => setStatus(account, 'DISABLED')}
                    disabled={busy === account.id}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                  >
                    Disable
                  </button>
                ) : (
                  <button
                    onClick={() => setStatus(account, 'ACTIVE')}
                    disabled={busy === account.id}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition disabled:opacity-50"
                  >
                    Enable
                  </button>
                )}
                <button
                  onClick={() => resetPassword(account)}
                  disabled={busy === account.id}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 transition disabled:opacity-50"
                >
                  Reset password
                </button>
                <button
                  onClick={() => revealPassword(account)}
                  disabled={busy === account.id}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50"
                >
                  Reveal password
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
