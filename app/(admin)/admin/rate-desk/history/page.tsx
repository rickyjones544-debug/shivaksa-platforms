import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/auth';
import { hasPermission } from '@/lib/rbac/authorization';
import HistoryClient from './HistoryClient';

export default async function RateHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getCurrentUser();
  if (!ctx) {
    redirect('/login?redirect=/admin/rate-desk/history');
  }
  if (!hasPermission(ctx, 'rate-desk', 'read')) {
    notFound();
  }
  const sp = await searchParams;
  const initialProviderId = typeof sp.providerId === 'string' ? sp.providerId : '';
  const initialPrefix = typeof sp.prefix === 'string' ? sp.prefix : '';
  return <HistoryClient initialProviderId={initialProviderId} initialPrefix={initialPrefix} />;
}
