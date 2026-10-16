#!/usr/bin/env bun
/**
 * bun run verify:hello --path noir|circom [--network testnet]
 */
import { $ } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getEnv, readEnvFile } from "./env";
import { parseNetworkFlag, TESTNET_PASSPHRASE, TESTNET_RPC } from "./network";

const ROOT = join(import.meta.dir, "..");
const circuit = process.argv[2] ?? "hello";
const pathIdx = process.argv.findIndex((a) => a === "--path");
const provingPath = (pathIdx >= 0 ? process.argv[pathIdx + 1] : process.env.PROVING_PATH) ?? "noir";
const network = parseNetworkFlag();
const send = process.argv.includes("--send-no") ? "no" : "yes";

const env = await readEnvFile();
const rpc = getEnv(env, "STELLAR_RPC_URL", TESTNET_RPC);
const passphrase = getEnv(env, "STELLAR_NETWORK_PASSPHRASE", TESTNET_PASSPHRASE);
const source = getEnv(env, "DEPLOYER_SECRET") || getEnv(env, "DEPLOYER_IDENTITY", "deployer");

const artifacts = join(ROOT, "artifacts", provingPath, circuit);

async function invoke(id: string, fn: string, args: string[]) {
  const cmd = [
    "stellar",
    "contract",
    "invoke",
    "--id",
    id,
    "--source-account",
    source,
    "--rpc-url",
    rpc,
    "--network-passphrase",
    passphrase,
    "--send",
    send,
    "--cost",
    "--",
    fn,
    ...args,
  ];
  console.log("$", cmd.join(" "));
  const proc = Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) process.exit(code);
}

if (provingPath === "noir") {
  const id = getEnv(env, "HELLO_UH_VERIFIER_ID") || getEnv(env, "VERIFIER_ULTRAHONK_ID");
  if (!id) {
    console.error("Missing HELLO_UH_VERIFIER_ID. Run bun run setup.");
    process.exit(1);
  }
  const pub = join(artifacts, "public_inputs");
  const proof = join(artifacts, "proof");
  if (!existsSync(pub) || !existsSync(proof)) {
    console.error("Missing artifacts. Run bun run prove:hello --path noir first.");
    process.exit(1);
  }
  await invoke(id, "verify_proof", [
    "--public_inputs-file-path",
    pub,
    "--proof_bytes-file-path",
    proof,
  ]);
} else {
  const id = getEnv(env, "HELLO_G16_VERIFIER_ID") || getEnv(env, "VERIFIER_GROTH16_ID");
  if (!id) {
    console.error("Missing HELLO_G16_VERIFIER_ID. Run bun run setup.");
    process.exit(1);
  }
  const proof = join(artifacts, "proof.bin");
  const pub = join(artifacts, "public.bin");
  if (!existsSync(proof) || !existsSync(pub)) {
    console.error("Missing artifacts. Run bun run prove:hello --path circom first.");
    process.exit(1);
  }
  await invoke(id, "verify", [
    "--proof_bytes-file-path",
    proof,
    "--pub_signals_bytes-file-path",
    pub,
  ]);
}

console.log(`✅ ${circuit} verified on ${network} (${provingPath})`);
