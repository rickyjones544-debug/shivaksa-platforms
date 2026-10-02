'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Signs the user out by POSTing to /api/auth/logout (the route is
 * intentionally POST-only), then returns the user to the login page.
 */
export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Even if the request fails, send the user back to the login screen.
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={className}
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
