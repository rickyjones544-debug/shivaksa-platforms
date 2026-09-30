import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/auth';
import { hasPermission } from '@/lib/rbac/authorization';
import ReviewClient from './ReviewClient';

export default async function RateSheetReviewPage({
  params,
}: {
  params: Promise<{ sheetId: string; version: string }>;
}) {
  const ctx = await getCurrentUser();
  if (!ctx) {
    redirect('/login?redirect=/admin/rate-desk');
  }
  if (!hasPermission(ctx, 'rate-desk', 'read')) {
    notFound();
  }
  const { sheetId, version } = await params;
  const versionNumber = Number.parseInt(version, 10);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    notFound();
  }
  const canWrite = hasPermission(ctx, 'rate-desk', 'write');
  return <ReviewClient sheetId={sheetId} version={versionNumber} canWrite={canWrite} />;
}
