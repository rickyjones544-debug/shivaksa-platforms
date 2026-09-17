import { Suspense } from 'react';
import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
          <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="mt-6 space-y-4">
            <div className="h-10 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            <div className="h-10 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            <div className="h-10 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
