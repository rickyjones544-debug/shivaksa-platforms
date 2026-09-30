import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/auth';
import { hasPermission } from '@/lib/rbac/authorization';
import CompareClient from './CompareClient';

export default async function RateComparePage() {
  const ctx = await getCurrentUser();
  if (!ctx) {
    redirect('/login?redirect=/admin/rate-desk/compare');
  }
  if (!hasPermission(ctx, 'rate-desk', 'read')) {
    notFound();
  }
  return <CompareClient />;
}
