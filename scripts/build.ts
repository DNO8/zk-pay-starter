#!/usr/bin/env bun
import { $ } from "bun";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { assertNotMainnet } from "./network";

assertNotMainnet(process.env.STELLAR_NETWORK ?? "testnet", "build");

const ROOT = join(import.meta.dir, "..");

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Building contracts");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
await $`stellar contract build --package verifier-ultrahonk --package verifier-groth16 --package hello-gate --package pool`.cwd(
  ROOT,
);

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Building Noir hello");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
await $`nargo compile`.cwd(join(ROOT, "circuits/noir/hello"));
await $`nargo execute`.cwd(join(ROOT, "circuits/noir/hello"));

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Building Circom hello");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
const helloDir = join(ROOT, "circuits/circom/hello");
mkdirSync(helloDir, { recursive: true });
await $`circom hello.circom --r1cs --wasm --sym -o ${helloDir}`.cwd(helloDir);

console.log("\n✅ build complete");
