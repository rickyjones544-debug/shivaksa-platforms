import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/auth';

export default async function AgentDashboard() {
  const ctx = await getCurrentUser();

  if (!ctx) {
    redirect('/login?redirect=/agent');
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Agent Dashboard
            </h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              {ctx.user.name} — {ctx.user.email} — {ctx.organization?.name}
            </p>
          </div>
          <Link
            href="/api/agent/calls"
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            View my calls
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/api/agent/calls"
            className="group block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:shadow-lg hover:shadow-zinc-900/5 dark:hover:shadow-zinc-950/20 hover:border-blue-300 dark:hover:border-blue-800 transition"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">My Calls</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">Review assigned calls and outcomes.</p>
          </Link>

          <Link
            href="/api/agent/performance"
            className="group block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:shadow-lg hover:shadow-zinc-900/5 dark:hover:shadow-zinc-950/20 hover:border-blue-300 dark:hover:border-blue-800 transition"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Performance</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">View activity and quality metrics.</p>
          </Link>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Agent notes</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Calls and QA reviews are logged against your account. Use the dashboard links above to view assigned activity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
