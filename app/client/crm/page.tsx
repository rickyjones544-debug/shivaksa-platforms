import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/auth';
import { listContacts } from '@/lib/crm/contacts';

export default async function CrmPage() {
  const ctx = await getCurrentUser();

  if (!ctx) {
    redirect('/login?redirect=/client/crm');
  }

  const contacts = await listContacts(ctx);

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        CRM — Contacts
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Organization: {ctx.organization?.name}
      </p>

      <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        {contacts.length === 0 ? (
          <p className="p-4 text-zinc-500">No contacts yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {contacts.map((contact) => (
              <li key={contact.id} className="p-4">
                <p className="font-medium text-zinc-900 dark:text-white">
                  {contact.firstName} {contact.lastName}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {contact.email} {contact.phone && `• ${contact.phone}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
