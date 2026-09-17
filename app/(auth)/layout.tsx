import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-12 bg-grid">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50/80 to-zinc-100 dark:from-blue-950/20 dark:to-zinc-950" />
      {children}
    </div>
  );
}
