import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/auth';
import VoiceTestClient from './VoiceTestClient';

export default async function VoiceTestPage() {
  const ctx = await getCurrentUser();

  if (!ctx) {
    redirect('/login?redirect=/admin/voice-test');
  }

  if (ctx.user.isSuperAdmin !== true) {
    notFound();
  }

  return <VoiceTestClient />;
}
