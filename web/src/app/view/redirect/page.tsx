'use client';

import { useEffect } from 'react';

// Some Smart Wallet flows return to `/view/redirect?...` on the dapp origin.
// We don't need those params for the demo app, but we should avoid a 404 and
// return the user back to the main page.
export default function ViewRedirectPage() {
  useEffect(() => {
    window.location.replace('/');
  }, []);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 p-6">
      <h1 className="text-lg font-semibold">Redirecting…</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Returning you to the demo app.
      </p>
    </main>
  );
}

