#!/usr/bin/env bun
import { $ } from "bun";
import { join } from "node:path";
import { getEnv, readEnvFile } from "./env";
import { TESTNET_PASSPHRASE, TESTNET_RPC, assertNotMainnet } from "./network";

assertNotMainnet("testnet", "bindings");
const ROOT = join(import.meta.dir, "..");
const env = await readEnvFile();
const rpc = getEnv(env, "STELLAR_RPC_URL", TESTNET_RPC);
const passphrase = getEnv(env, "STELLAR_NETWORK_PASSPHRASE", TESTNET_PASSPHRASE);

const contracts = [
  ["verifier-ultrahonk", getEnv(env, "VERIFIER_ULTRAHONK_ID")],
  ["verifier-groth16", getEnv(env, "VERIFIER_GROTH16_ID")],
  ["hello-gate", getEnv(env, "HELLO_GATE_ID")],
  ["pool", getEnv(env, "POOL_ID")],
] as const;

for (const [name, id] of contracts) {
  if (!id) {
    console.warn(`⚠️  skip ${name}: no contract id`);
    continue;
  }
  const out = join(ROOT, "bindings", name);
  console.log(`bindings ${name} → ${out}`);
  let ok = false;
  for (let i = 1; i <= 5; i++) {
    try {
      await $`stellar contract bindings typescript --contract-id ${id} --output-dir ${out} --rpc-url ${rpc} --network-passphrase ${passphrase} --overwrite`.cwd(
        ROOT,
      );
      ok = true;
      break;
    } catch (e) {
      console.log(`  retry ${i}/5...`);
      await Bun.sleep(3000);
    }
  }
  if (!ok) throw new Error(`bindings failed for ${name}`);
}
console.log("✅ bindings");
