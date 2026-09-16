import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/client" className="font-bold text-zinc-900 dark:text-white">
            Shivaksa
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/client" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">Dashboard</Link>
            <Link href="/voip" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">VoIP</Link>
            <Link href="/voip/wallet" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">Wallet</Link>
            <Link href="/onboarding" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">Onboarding</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto">{children}</main>
    </div>
  );
}
