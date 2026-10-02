'use client';

import { useEffect, useState } from 'react';

interface Member {
  id: string;
  userId: string;
  status: string;
  joinedAt: string;
  user: { id: string; name: string; email: string };
  role: { id: string; name: string; description?: string | null };
}

interface RoleOption {
  id: string;
  name: string;
  description?: string | null;
}

const MEMBERSHIP_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED'] as const;

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

function statusTone(status: string): 'green' | 'red' | 'amber' | 'zinc' {
  if (status === 'ACTIVE') return 'green';
  if (status === 'SUSPENDED') return 'red';
  if (status === 'PENDING') return 'amber';
  return 'zinc';
}

export default function MembersPanel({
  customerId,
  onError,
  onMessage,
}: {
  customerId: string;
  onError: (message: string | null) => void;
  onMessage: (message: string | null) => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    const [membersRes, rolesRes] = await Promise.all([
      fetch(`/api/admin/organizations/${customerId}/members`, { credentials: 'include' }),
      fetch('/api/admin/roles', { credentials: 'include' }),
    ]);
    const membersJson = await membersRes.json();
    const rolesJson = await rolesRes.json();
    if (!membersJson.success) throw new Error(membersJson.error || 'Failed to load members');
    setMembers(membersJson.data || []);
    if (rolesJson.success) setRoles(rolesJson.data || []);
  }

  useEffect(() => {
    load()
      .catch((err) => onError(err instanceof Error ? err.message : 'Failed to load members'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function createMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    onError(null);
    onMessage(null);
    try {
      const formData = new FormData(e.currentTarget);
      const res = await fetch(`/api/admin/organizations/${customerId}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name')?.toString(),
          email: formData.get('email')?.toString(),
          password: formData.get('password')?.toString(),
          roleId: formData.get('roleId')?.toString(),
          status: 'PENDING',
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create user');
      onMessage('Customer user created as PENDING. Activate the membership below when ready.');
      setShowCreate(false);
      (e.target as HTMLFormElement).reset();
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(member: Member, status: string) {
    if (!confirm(`Set ${member.user.email} membership to ${status}?`)) return;
    setBusy(member.id);
    onError(null);
    onMessage(null);
    try {
      const res = await fetch(`/api/admin/organizations/${customerId}/members/${member.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Update failed');
      onMessage(`Membership ${status.toLowerCase()}`);
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  async function setRole(member: Member, roleId: string) {
    if (roleId === member.role.id) return;
    setBusy(member.id);
    onError(null);
    onMessage(null);
    try {
      const res = await fetch(`/api/admin/organizations/${customerId}/members/${member.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Role update failed');
      onMessage('Role updated');
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Role update failed');
    } finally {
      setBusy(null);
    }
  }

  const defaultRoleId = roles.find((r) => r.name === 'CLIENT_ADMIN')?.id ?? roles[0]?.id ?? '';

  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Customer Users</h2>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
        >
          {showCreate ? 'Cancel' : 'Create customer user'}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={createMember}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Name</label>
            <input
              name="name"
              type="text"
              required
              minLength={2}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-zinc-500">Min 8 chars, upper, lower, number, special. Give this to the customer securely.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Role</label>
            <select
              name="roleId"
              required
              defaultValue={defaultRoleId}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white px-3 py-2 text-sm"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create user (PENDING)'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No customer users yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Name</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Email</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Role</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Status</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3 text-zinc-900 dark:text-white font-medium">{member.user.name}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{member.user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={member.role.id}
                      disabled={busy === member.id || roles.length === 0}
                      onChange={(e) => setRole(member, e.target.value)}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white px-2 py-1 text-xs"
                    >
                      {!roles.some((r) => r.id === member.role.id) && (
                        <option value={member.role.id}>{member.role.name}</option>
                      )}
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3"><Pill label={member.status} tone={statusTone(member.status)} /></td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {MEMBERSHIP_STATUSES.filter((s) => s !== member.status).map((status) => (
                        <button
                          key={status}
                          onClick={() => setStatus(member, status)}
                          disabled={busy === member.id}
                          className={`text-xs font-medium disabled:opacity-50 ${
                            status === 'ACTIVE'
                              ? 'text-emerald-500 hover:text-emerald-400'
                              : status === 'SUSPENDED'
                                ? 'text-red-500 hover:text-red-400'
                                : 'text-amber-500 hover:text-amber-400'
                          }`}
                        >
                          {status === 'ACTIVE' ? 'Activate' : status === 'SUSPENDED' ? 'Suspend' : 'Set pending'}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
