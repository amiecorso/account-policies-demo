'use client';

import Link from 'next/link';
import { MoiraiDelegatePolicyDemo } from '../../components/MoiraiDelegatePolicyDemo';
import { SmartWalletConnect } from '../../components/SmartWalletConnect';

export default function MoiraiDelegatePage() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-950 dark:bg-black dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-6">
          <span className="mr-4 py-3 text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Account Policies</span>
          <span className="mr-1 py-3 text-zinc-300 dark:text-zinc-700">/</span>
          <Link
            href="/"
            className="border-b-2 border-transparent px-3 py-3 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Morpho Lend
          </Link>
          <Link
            href="/moirai-delegate"
            className="border-b-2 border-zinc-900 px-3 py-3 text-sm font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
          >
            Moirai Delegate
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <p className="text-zinc-600 dark:text-zinc-400">
          Connect with a Coinbase Smart Wallet sub-account. This route uses its
          own isolated wallet provider.
        </p>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <SmartWalletConnect showSubAccount />
        </div>

        <MoiraiDelegatePolicyDemo />
      </main>
    </div>
  );
}
