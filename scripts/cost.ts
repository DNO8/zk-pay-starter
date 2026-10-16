#!/usr/bin/env bun
/**
 * Print budgeted Soroban CPU instructions from simulateTransaction.
 * stellar --cost prints fees, not the insn count.
 *
 *   bun run scripts/cost.ts hello --path noir
 *   bun run scripts/cost.ts hello --path circom
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Contract, Keypair, nativeToScVal, rpc, TransactionBuilder } from "@stellar/stellar-sdk";
import { getEnv, readEnvFile } from "./env";
import { parseNetworkFlag, TESTNET_PASSPHRASE, TESTNET_RPC } from "./network";

const ROOT = join(import.meta.dir, "..");
const circuit = process.argv[2] ?? "hello";
const pathIdx = process.argv.findIndex((a) => a === "--path");
const provingPath = (pathIdx >= 0 ? process.argv[pathIdx + 1] : process.env.PROVING_PATH) ?? "noir";
parseNetworkFlag();

const env = await readEnvFile();
const rpcUrl = getEnv(env, "STELLAR_RPC_URL", TESTNET_RPC);
const passphrase = getEnv(env, "STELLAR_NETWORK_PASSPHRASE", TESTNET_PASSPHRASE);
const secret = getEnv(env, "DEPLOYER_SECRET");
if (!secret) {
  console.error("Missing DEPLOYER_SECRET. Run bun run setup.");
  process.exit(1);
}

const server = new rpc.Server(rpcUrl);
const kp = Keypair.fromSecret(secret);
const acc = await server.getAccount(kp.publicKey());
const artifacts = join(ROOT, "artifacts", provingPath, circuit);

let id: string;
let fn: string;
let args: ReturnType<typeof nativeToScVal>[];
if (provingPath === "noir") {
  id = getEnv(env, "HELLO_UH_VERIFIER_ID") || getEnv(env, "VERIFIER_ULTRAHONK_ID");
  fn = "verify_proof";
  args = [
    nativeToScVal(readFileSync(join(artifacts, "public_inputs")), { type: "bytes" }),
    nativeToScVal(readFileSync(join(artifacts, "proof")), { type: "bytes" }),
  ];
} else {
  id = getEnv(env, "HELLO_G16_VERIFIER_ID") || getEnv(env, "VERIFIER_GROTH16_ID");
  fn = "verify";
  args = [
    nativeToScVal(readFileSync(join(artifacts, "proof.bin")), { type: "bytes" }),
    nativeToScVal(readFileSync(join(artifacts, "public.bin")), { type: "bytes" }),
  ];
}
if (!id) {
  console.error("Missing verifier id. Run bun run setup.");
  process.exit(1);
}

const tx = new TransactionBuilder(acc, { fee: "10000000", networkPassphrase: passphrase })
  .addOperation(new Contract(id).call(fn, ...args))
  .setTimeout(60)
  .build();
const sim = await server.simulateTransaction(tx);
if ("error" in sim && sim.error) {
  console.error(sim.error);
  process.exit(1);
}
const resources = (
  sim.transactionData as unknown as {
    _data: { _attributes: { resources: { _attributes: { instructions: number } } } };
  }
)._data._attributes.resources._attributes;
console.log(
  JSON.stringify(
    {
      path: provingPath,
      circuit,
      contract: id,
      cpuInstructions: resources.instructions,
      minResourceFee: sim.minResourceFee,
    },
    null,
    2,
  ),
);
