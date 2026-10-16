#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { assertNotMainnet } from "./network";

assertNotMainnet(process.env.STELLAR_NETWORK ?? "testnet", "setup");
const ROOT = join(import.meta.dir, "..");

console.log("zk-pay-starter setup (testnet only)\n");

if (!existsSync(join(ROOT, "node_modules/@stellar/stellar-sdk"))) {
  console.log("Installing JS dependencies...\n");
  await $`bun install`.cwd(ROOT);
}

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("1/6  doctor");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
await $`bun run doctor`.cwd(ROOT);

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("2/6  build contracts + hello circuits");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
await $`bun run build`.cwd(ROOT);

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("3/6  prove hello on both paths (writes VK + proof artifacts)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
await $`bun run prove:hello --path noir`.cwd(ROOT);
await $`bun run prove:hello --path circom`.cwd(ROOT);

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("4/6  fund keys + deploy verifiers, hello-gate, pool");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
await $`bun run deploy`.cwd(ROOT);

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("5/6  TypeScript bindings");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
await $`bun run bindings`.cwd(ROOT);

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("6/6  GIVEN tests");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
await $`bun run test:given`.cwd(ROOT);

console.log(`
🎉 M0 complete.

Next (M1): verify the hello proofs on testnet:

  bun run verify:hello --path noir --network testnet
  bun run verify:hello --path circom --network testnet

Or open the /debug page:

  bun run dev
`);
