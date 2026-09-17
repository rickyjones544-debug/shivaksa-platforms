import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/auth';

const actions = [
  {
    href: '/voip',
    label: 'VoIP Dashboard',
    description: 'Manage SIP accounts, review calls, and monitor usage.',
    color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    icon: 'phone',
  },
  {
    href: '/voip/wallet',
    label: 'Wallet & Billing',
    description: 'View balance, transactions, and customer rate.',
    color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    icon: 'wallet',
  },
  {
    href: '/onboarding',
    label: 'Business Onboarding',
    description: 'Submit or review your business verification details.',
    color: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400',
    icon: 'document',
  },
  {
    href: '/client/crm',
    label: 'CRM',
    description: 'Manage contacts, leads, and campaigns.',
    color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    icon: 'users',
  },
];

function Icon({ name }: { name: string }) {
  const props = { className: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.5 };
  if (name === 'phone') {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    );
  }
  if (name === 'wallet') {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 12V5.25A2.25 2.25 0 014.5 3h14.25A2.25 2.25 0 0121 5.25V12z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 8.25h1.5a2.25 2.25 0 012.25 2.25V12a2.25 2.25 0 01-2.25 2.25H18M18 8.25V12M18 8.25a2.25 2.25 0 00-2.25-2.25h-1.5" />
      </svg>
    );
  }
  if (name === 'document') {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.762 9.38 9.38 0 002.625-.762M15 19.128V17.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25v1.878m0 0A9.38 9.38 0 015.625 19.128M6 17.25v-1.5m0 1.5a9.38 9.38 0 01-1.375-.762M15 4.75a2.25 2.25 0 012.25 2.25V9a2.25 2.25 0 01-2.25 2.25h-6.5A2.25 2.25 0 016.25 9V7A2.25 2.25 0 018.5 4.75h6.5z" />
    </svg>
  );
}

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
                <Icon name={action.icon} />
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
