import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from './auth';
import { isPlatformOperator } from '@/lib/rbac/authorization';

export async function requirePlatformAdminPage(returnTo: string) {
  const ctx = await getCurrentUser();
  if (!ctx) {
    redirect(`/login?redirect=${encodeURIComponent(returnTo)}`);
  }
  if (!isPlatformOperator(ctx)) {
    notFound();
  }
  return ctx;
}
