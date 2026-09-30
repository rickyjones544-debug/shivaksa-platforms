import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/auth';
import { hasPermission } from '@/lib/rbac/authorization';
import RateSheetsClient from './RateSheetsClient';

export default async function RateDeskPage() {
  const ctx = await getCurrentUser();
  if (!ctx) {
    redirect('/login?redirect=/admin/rate-desk');
  }
  if (!hasPermission(ctx, 'rate-desk', 'read')) {
    notFound();
  }
  const canWrite = hasPermission(ctx, 'rate-desk', 'write');
  return <RateSheetsClient canWrite={canWrite} />;
}
