'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    SUSPENDED: 'bg-red-500/10 text-red-500 border-red-500/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes[status] || 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}`}>
      {status}
    </span>
  );
}

export default function AdminOrganizationsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function load() {
    const res = await fetch('/api/admin/organizations', { credentials: 'include' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to load organizations');
    setOrganizations(json.data || []);
  }

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function createOrganization(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const form = e.currentTarget;
      const name = (new FormData(form).get('name')?.toString() || '').trim();
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create organization');
      router.push(`/admin/voip/customers/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
      setCreating(false);
    }
  }

  async function setStatus(org: Organization, status: 'ACTIVE' | 'SUSPENDED') {
    if (!confirm(`${status === 'SUSPENDED' ? 'Suspend' : 'Reactivate'} ${org.name}?`)) return;
    setBusy(org.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Update failed');
      setMessage(`${org.name} ${status === 'SUSPENDED' ? 'suspended' : 'reactivated'}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  async function rename(org: Organization) {
    const name = editName.trim();
    setEditing(null);
    if (!name || name === org.name) return;
    setBusy(org.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Rename failed');
      setMessage('Organization renamed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Organization Management
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Create and manage customer organizations.
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-400 text-sm">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Create Organization</h2>
          <form onSubmit={createOrganization} className="flex flex-col sm:flex-row gap-3">
            <input
              name="name"
              type="text"
              required
              minLength={2}
              placeholder="Organization name"
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create & continue to onboarding'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          {loading ? (
            <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
          ) : organizations.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">No organizations found.</p>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Name</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Status</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                    <td className="px-4 py-3">
                      {editing === org.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            rename(org);
                          }}
                          className="flex items-center gap-2"
                        >
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            autoFocus
                            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white px-2 py-1 text-sm"
                          />
                          <button type="submit" className="text-blue-600 text-xs font-medium">Save</button>
                          <button type="button" onClick={() => setEditing(null)} className="text-zinc-500 text-xs">Cancel</button>
                        </form>
                      ) : (
                        <span className="font-medium text-zinc-900 dark:text-white">{org.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={org.status} /></td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => { setEditing(org.id); setEditName(org.name); }}
                          disabled={busy === org.id}
                          className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs font-medium disabled:opacity-50"
                        >
                          Rename
                        </button>
                        {org.status === 'ACTIVE' ? (
                          <button
                            onClick={() => setStatus(org, 'SUSPENDED')}
                            disabled={busy === org.id}
                            className="text-red-500 hover:text-red-400 text-xs font-medium disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => setStatus(org, 'ACTIVE')}
                            disabled={busy === org.id}
                            className="text-emerald-500 hover:text-emerald-400 text-xs font-medium disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )}
                        <Link
                          href={`/admin/voip/customers/${org.id}`}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-500 text-xs font-medium"
                        >
                          Manage
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
