import { Keypair } from "@stellar/stellar-sdk";
import { FRIENDBOT, TESTNET_HORIZON } from "./network";

export type Wallet = { name: string; publicKey: string; secret: string };

export async function accountExists(address: string): Promise<boolean> {
  const res = await fetch(`${TESTNET_HORIZON}/accounts/${address}`);
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Horizon ${res.status} for ${address}`);
  return true;
}

export async function fund(address: string): Promise<void> {
  if (await accountExists(address)) return;
  console.log(`💰 Friendbot ${address}`);
  const res = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(address)}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Friendbot failed (${res.status}): ${body.slice(0, 200)}`);
  }
  for (let i = 0; i < 8; i++) {
    await Bun.sleep(500);
    if (await accountExists(address)) return;
  }
  throw new Error(`Funded ${address} but Horizon does not see it yet`);
}

export function restoreOrCreate(name: string, existingSecret?: string): Wallet {
  const kp = existingSecret ? Keypair.fromSecret(existingSecret) : Keypair.random();
  return { name, publicKey: kp.publicKey(), secret: kp.secret() };
}

export async function ensureWallets(
  names: string[],
  existing: Record<string, string>,
): Promise<Wallet[]> {
  const out: Wallet[] = [];
  for (const name of names) {
    const envKey = `${name.toUpperCase().replace(/-/g, "_")}_SECRET`;
    const w = restoreOrCreate(name, existing[envKey]);
    await fund(w.publicKey);
    out.push(w);
    console.log(`✅ ${name}: ${w.publicKey}`);
  }
  return out;
}
