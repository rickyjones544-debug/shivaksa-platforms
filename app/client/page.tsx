import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/auth';

export default async function ClientDashboard() {
  const ctx = await getCurrentUser();

  if (!ctx) {
    redirect('/login?redirect=/client');
  }

  const links = [
    { href: '/voip', label: 'VoIP Dashboard', description: 'Manage SIP accounts, calls, and usage.' },
    { href: '/voip/wallet', label: 'Wallet & Billing', description: 'View balance, transactions, and customer rate.' },
    { href: '/onboarding', label: 'Business Onboarding', description: 'Submit or review your business verification details.' },
    { href: '/client/crm', label: 'CRM', description: 'Manage contacts and leads.' },
  ];

  return (
    <div className="min-h-screen p-6 sm:p-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          Client Dashboard
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Welcome, {ctx.user.name} ({ctx.user.email}) — {ctx.organization?.name}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:shadow-sm transition"
            >
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{l.label}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{l.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
