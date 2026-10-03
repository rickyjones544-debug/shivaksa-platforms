import { requirePlatformAdminPage } from '@/lib/auth/admin-page';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdminPage('/admin');
  return children;
}
