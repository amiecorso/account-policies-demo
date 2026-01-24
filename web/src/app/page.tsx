'use client';

import { MorphoLendPolicyDemo } from '../components/MorphoLendPolicyDemo';
import { SmartWalletConnect } from '../components/SmartWalletConnect';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-950 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-20">
        <h1 className="text-3xl font-semibold tracking-tight">
          Account Policies Demo
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Connect with a Coinbase Smart Wallet (EOAs aren’t supported for this
          protocol).
        </p>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <SmartWalletConnect />
        </div>

        <MorphoLendPolicyDemo />
      </main>
    </div>
  );
}
