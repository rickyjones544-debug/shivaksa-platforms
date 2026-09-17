import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/auth';

const adminModules = [
  {
    href: '/admin/organizations',
    label: 'Organizations',
    description: 'Manage tenants, members and invitations.',
    color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
  },
  {
    href: '/admin/onboarding',
    label: 'Onboarding Reviews',
    description: 'Review and approve KYC/KYB submissions.',
    color: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400',
  },
  {
    href: '/admin/voip',
    label: 'VoIP Customers',
    description: 'View customer VoIP services, SIP accounts and usage.',
    color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
  },
  {
    href: '/admin/users',
    label: 'Users',
    description: 'Inspect platform users and roles.',
    color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
  },
];

export default async function AdminDashboard() {
  const ctx = await getCurrentUser();

  if (!ctx) {
    redirect('/login?redirect=/admin');
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              {ctx.user.name} — {ctx.user.email} — {ctx.organization?.name}
            </p>
          </div>
          <Link
            href="/admin/organizations"
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Manage organizations
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {adminModules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="group block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:shadow-lg hover:shadow-zinc-900/5 dark:hover:shadow-zinc-950/20 hover:border-blue-300 dark:hover:border-blue-800 transition"
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 ${module.color}`}>
                <span className="text-lg font-bold">{module.label.charAt(0)}</span>
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{module.label}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{module.description}</p>
            </Link>
          ))}
        </div>

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Administration notes</h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed max-w-3xl">
            This admin portal is scoped to your current organization and role. Tenant isolation, KYC review, wallet auditing, and VoIP service management are all logged for accountability.
          </p>
        </section>
      </div>
    </div>
  );
}
