import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/auth';

const actions = [
  {
    href: '/voip',
    label: 'VoIP Dashboard',
    description: 'Manage SIP accounts, review calls, and monitor usage.',
    color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
  },
  {
    href: '/voip/wallet',
    label: 'Wallet & Billing',
    description: 'View balance, transactions, and customer rate.',
    color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
  },
  {
    href: '/onboarding',
    label: 'Business Onboarding',
    description: 'Submit or review your business verification details.',
    color: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400',
  },
  {
    href: '/client/crm',
    label: 'CRM',
    description: 'Manage contacts, leads, and campaigns.',
    color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
  },
];

export default async function ClientDashboard() {
  const ctx = await getCurrentUser();

  if (!ctx) {
    redirect('/login?redirect=/client');
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Welcome, {ctx.user.name}
            </h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              {ctx.organization?.name} — {ctx.user.email}
            </p>
          </div>
          <Link
            href="/voip"
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Go to VoIP
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:shadow-lg hover:shadow-zinc-900/5 dark:hover:shadow-zinc-950/20 hover:border-blue-300 dark:hover:border-blue-800 transition"
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 ${action.color}`}>
                <span className="text-lg font-bold">{action.label.charAt(0)}</span>
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{action.label}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{action.description}</p>
            </Link>
          ))}
        </div>

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Getting started</h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed max-w-3xl">
            Complete your business onboarding to enable VoIP services. Once approved, you can configure SIP accounts,
            add funds to your wallet, and start placing business calls. Wallet top-ups are currently managed by your administrator.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              Start onboarding
            </Link>
            <Link
              href="/voip/wallet"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              View wallet
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
