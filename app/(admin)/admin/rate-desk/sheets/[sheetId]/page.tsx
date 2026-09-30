import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/auth';
import { hasPermission } from '@/lib/rbac/authorization';
import SheetDetailClient from './SheetDetailClient';

export default async function RateSheetDetailPage({
  params,
}: {
  params: Promise<{ sheetId: string }>;
}) {
  const ctx = await getCurrentUser();
  if (!ctx) {
    redirect('/login?redirect=/admin/rate-desk');
  }
  if (!hasPermission(ctx, 'rate-desk', 'read')) {
    notFound();
  }
  const { sheetId } = await params;
  const canWrite = hasPermission(ctx, 'rate-desk', 'write');
  return <SheetDetailClient sheetId={sheetId} canWrite={canWrite} />;
}
