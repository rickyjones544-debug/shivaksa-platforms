import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/auth';
import { hasPermission } from '@/lib/rbac/authorization';
import { listOrganizations } from '@/lib/organizations/service';

export default async function AdminOrganizationsPage() {
  const ctx = await getCurrentUser();

  if (!ctx) {
    redirect('/login?redirect=/admin/organizations');
  }

  if (!hasPermission(ctx, 'organization', 'read')) {
    redirect('/admin');
  }

  const organizations = await listOrganizations(ctx);

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        Organization Management
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Manage organizations you are authorized to view.
      </p>

      <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        {organizations.length === 0 ? (
          <p className="p-4 text-zinc-500">No organizations found.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {organizations.map((org) => (
              <li key={org.id} className="p-4">
                <p className="font-medium text-zinc-900 dark:text-white">{org.name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {org.slug} • {org.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
