## Account Policies Demo (web app)

Next.js app for the Account Policies demo (Morpho Lend Policy).

### Setup

From the repo root:

```bash
npm install
cp env.example .env.local
```

Fill in `web/.env.local` as needed (see `web/env.example` for the full list).

### Run

From the repo root:

```bash
npm run -w web dev
```

### Build

```bash
npm run -w web build
```

### Notes

- **Smart Wallet only**: this demo expects Coinbase Smart Contract Wallet flows. For local wallet dev, set
  `NEXT_PUBLIC_BASE_ACCOUNT_WALLET_URL=http://localhost:3005/connect`.
- **Local policy config persistence**: installed `policyConfig` is stored in `web/.policy-store.json` (git-ignored).
