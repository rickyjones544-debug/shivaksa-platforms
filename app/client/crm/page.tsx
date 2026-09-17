import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/auth';
import { listContacts } from '@/lib/crm/contacts';

export default async function CrmPage() {
  const ctx = await getCurrentUser();

  if (!ctx) {
    redirect('/login?redirect=/client/crm');
  }

  const contacts = await listContacts(ctx);

  return (
    <div className="min-h-screen p-6 sm:p-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">CRM — Contacts</h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{ctx.organization?.name}</p>
          </div>
          <Link
            href="/client"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          {contacts.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
              <p className="text-lg font-medium text-zinc-900 dark:text-white mb-1">No contacts yet</p>
              <p className="text-sm">Contacts will appear here once you or your team add them.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {contacts.map((contact) => (
                <li key={contact.id} className="p-4 sm:p-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                  <p className="font-semibold text-zinc-900 dark:text-white">
                    {contact.firstName} {contact.lastName}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    {contact.email}
                    {contact.phone && <span className="ml-2">• {contact.phone}</span>}
                    {contact.company && <span className="ml-2">• {contact.company}</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
