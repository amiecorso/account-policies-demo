import { promises as fs } from 'fs';
import path from 'path';
import type { Hex } from 'viem';

export type StoredPolicy = {
  chainId: number;
  account: `0x${string}`;
  policyId: Hex;
  policy: `0x${string}`;
  policyConfig: Hex;
  binding: {
    validAfter: string;
    validUntil: string;
    salt: string;
    policyConfigHash: Hex;
  };
  installTxHash?: Hex;
  uninstalled?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
};

type DbShape = {
  version: 1;
  policies: StoredPolicy[];
};

const DB_PATH = path.join(process.cwd(), '.policy-store.json');

async function readDb(): Promise<DbShape> {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as DbShape;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.policies)) {
      return { version: 1, policies: [] };
    }
    return parsed;
  } catch {
    return { version: 1, policies: [] };
  }
}

async function writeDb(db: DbShape): Promise<void> {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

export async function listPolicies(input: {
  chainId: number;
  account: `0x${string}`;
}): Promise<StoredPolicy[]> {
  const db = await readDb();
  return db.policies.filter(
    (p) => p.chainId === input.chainId && p.account.toLowerCase() === input.account.toLowerCase(),
  );
}

export async function getPolicy(input: {
  chainId: number;
  account: `0x${string}`;
  policyId: Hex;
}): Promise<StoredPolicy | null> {
  const db = await readDb();
  const found = db.policies.find(
    (p) =>
      p.chainId === input.chainId &&
      p.account.toLowerCase() === input.account.toLowerCase() &&
      p.policyId.toLowerCase() === input.policyId.toLowerCase(),
  );
  return found ?? null;
}

export async function upsertPolicy(p: Omit<StoredPolicy, 'createdAtMs' | 'updatedAtMs'>): Promise<StoredPolicy> {
  const db = await readDb();
  const now = Date.now();
  const idx = db.policies.findIndex(
    (x) =>
      x.chainId === p.chainId &&
      x.account.toLowerCase() === p.account.toLowerCase() &&
      x.policyId.toLowerCase() === p.policyId.toLowerCase(),
  );
  if (idx >= 0) {
    const next: StoredPolicy = { ...db.policies[idx], ...p, updatedAtMs: now };
    db.policies[idx] = next;
    await writeDb(db);
    return next;
  }
  const next: StoredPolicy = { ...p, createdAtMs: now, updatedAtMs: now };
  db.policies.unshift(next);
  await writeDb(db);
  return next;
}

export async function deletePolicy(input: {
  chainId: number;
  account: `0x${string}`;
  policyId: Hex;
}): Promise<boolean> {
  const db = await readDb();
  const before = db.policies.length;
  db.policies = db.policies.filter(
    (p) =>
      !(
        p.chainId === input.chainId &&
        p.account.toLowerCase() === input.account.toLowerCase() &&
        p.policyId.toLowerCase() === input.policyId.toLowerCase()
      ),
  );
  const changed = db.policies.length !== before;
  if (changed) await writeDb(db);
  return changed;
}

