#!/usr/bin/env bun
import { $ } from "bun";
import { PINS, TOOL_INSTALL } from "./pins";
import { TESTNET_RPC, assertNotMainnet } from "./network";

function fail(msg: string, hint?: string): never {
  console.error(`❌ ${msg}`);
  if (hint) console.error(`   ${hint}`);
  process.exit(1);
}

function ok(msg: string) {
  console.log(`✅ ${msg}`);
}

async function cmdVersion(bin: string): Promise<string> {
  try {
    const out = await $`${bin} --version`.quiet().text();
    return out.trim();
  } catch {
    try {
      const out = await $`${bin} version`.quiet().text();
      return out.trim();
    } catch {
      return "";
    }
  }
}

const nargo = await cmdVersion("nargo");
const bb = await cmdVersion("bb");
const circom = await cmdVersion("circom");
const stellar = await cmdVersion("stellar");
const rustc = await cmdVersion("rustc");
const bunV = Bun.version;

if (!rustc.includes(PINS.rust)) {
  fail(`rustc must be ${PINS.rust} (got: ${rustc || "missing"})`, TOOL_INSTALL.rust);
}
ok(`rustc ${PINS.rust}`);

if (!stellar.includes(PINS.stellarCli)) {
  fail(
    `stellar CLI must be ${PINS.stellarCli} (got: ${stellar || "missing"})`,
    TOOL_INSTALL.stellar,
  );
}
ok(`stellar ${PINS.stellarCli}`);

if (!nargo.includes(PINS.nargo)) {
  fail(`nargo must be ${PINS.nargo} (got: ${nargo || "missing"})`, TOOL_INSTALL.nargo);
}
ok(`nargo ${PINS.nargo}`);

if (!bb.includes(PINS.bb)) {
  fail(`bb must be ${PINS.bb} (got: ${bb || "missing"})`, TOOL_INSTALL.bb);
}
ok(`bb ${PINS.bb}`);

if (!circom.includes(PINS.circom)) {
  fail(`circom must be ${PINS.circom} (got: ${circom || "missing"})`, TOOL_INSTALL.circom);
}
ok(`circom ${PINS.circom}`);

const bunMajor = Number(bunV.split(".")[0]);
if (bunMajor < PINS.bunMajor) fail(`bun 1.x required (got ${bunV})`, TOOL_INSTALL.bun);
ok(`bun ${bunV}`);

const wasm = await $`rustup target list --installed`.quiet().text();
if (!wasm.includes("wasm32v1-none")) {
  fail("missing rust target wasm32v1-none", "rustup target add wasm32v1-none");
}
ok("wasm32v1-none target");

assertNotMainnet("testnet");
const rpc = process.env.STELLAR_RPC_URL ?? TESTNET_RPC;
try {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getNetwork" }),
  });
  const body = (await res.json()) as {
    result?: { passphrase?: string; protocolVersion?: number };
  };
  const pass = body.result?.passphrase ?? "";
  const proto = body.result?.protocolVersion ?? 0;
  if (pass.toLowerCase().includes("public global")) fail("RPC looks like mainnet — aborting");
  if (proto < PINS.protocolMin) {
    fail(`testnet protocol ${proto} < ${PINS.protocolMin} (UltraHonk needs ≥ 28)`);
  }
  ok(`testnet RPC protocol ${proto} (${rpc})`);
} catch (e) {
  console.warn(`⚠️  could not query testnet RPC: ${e}`);
}

console.log("\nDoctor OK. Pins:");
console.log(JSON.stringify(PINS, null, 2));
