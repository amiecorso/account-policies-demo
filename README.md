# Account Policies Demo (Morpho Lend Policy)

This repo is a **demo Next.js app** showcasing Coinbase **Smart Contract Wallet** (SCW) interactions with the **Account Policies** protocol, focused on the **MorphoLendPolicy**.

## What this app does

For a connected **Coinbase Smart Wallet**:

- Configure a **Morpho lend policy** (vault + executor + recurring allowance window).
- **Install** the policy via **EIP-712 signature** from the wallet; the app broadcasts the on-chain install tx.
- Show a dashboard of installed policies (indexed from events), including **installed/revoked** status and the install window.
- **Execute** “auto-lend” via the app’s **executor EOA** (no user signature required for execution).
- **Revoke** installed policies.
- Persist `policyConfig` off-chain locally so the UI can execute later without asking you to paste bytes:
  - Stored in `web/.policy-store.json` (git-ignored).

## Prerequisites

- **Node.js** + **npm**
- A local or hosted Coinbase Smart Wallet connect service:
  - For local dev we use `NEXT_PUBLIC_BASE_ACCOUNT_WALLET_URL=http://localhost:3005/connect`
- Base Sepolia RPC access (defaults to `https://sepolia.base.org`)

## Setup

Install dependencies from the repo root (npm workspaces):

```bash
npm install
```

Create your env file:

```bash
cp web/env.example web/.env.local
```

Fill in the values in `web/.env.local` (see **Env vars** below).

## Run

From the repo root:

```bash
npm run -w web dev
```

Open the app at `http://localhost:3000`.

## Build

```bash
npm run -w web build
```

## Env vars (required)

In `web/.env.local`:

- **Client**
  - `NEXT_PUBLIC_CHAIN_ID` (Base Sepolia: `84532`)
  - `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`
  - `NEXT_PUBLIC_BASE_ACCOUNT_WALLET_URL` (e.g. `http://localhost:3005/connect`)
  - `NEXT_PUBLIC_EXECUTOR_ADDRESS` (EOA address that will broadcast executes/installs)
  - `NEXT_PUBLIC_PUBLIC_ERC6492_VALIDATOR_ADDRESS`
  - `NEXT_PUBLIC_POLICY_MANAGER_ADDRESS`
  - `NEXT_PUBLIC_MORPHO_LEND_POLICY_ADDRESS`
  - `NEXT_PUBLIC_POLICY_EVENTS_FROM_BLOCK` (starting block for indexing `PolicyInstalled`)
  - `NEXT_PUBLIC_DEMO_USDC_VAULT_ADDRESS` (the demo vault address)
  - `NEXT_PUBLIC_DEMO_USDC_ADDRESS` (optional; display only)

- **Server-only**
  - `BASE_SEPOLIA_RPC_URL`
  - `EXECUTOR_PRIVATE_KEY` (private key for the executor EOA; **do not commit**)

`NEXT_PUBLIC_ONCHAINKIT_API_KEY` is optional.

## Contracts (local dev / redeploys)

The contracts live under `account-policies/` and use Foundry. In this demo repo, that directory is intentionally **git-ignored**.

If you redeploy `PolicyManager` or `MorphoLendPolicy`, update the corresponding env vars in `web/.env.local` and restart the dev server.

