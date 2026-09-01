import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/auth';

export default async function ClientDashboard() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?redirect=/client');
  }

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
        Client Dashboard
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Welcome, {user.name} ({user.email})
      </p>
    </div>
  );
}
