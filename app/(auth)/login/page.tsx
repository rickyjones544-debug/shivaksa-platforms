import { Suspense } from 'react';
import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
          <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
