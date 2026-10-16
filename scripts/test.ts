#!/usr/bin/env bun
import { $ } from "bun";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const givenOnly = process.argv.includes("--given");

console.log("GIVEN tests (must be green on main)\n");

let failed = false;
const run = async (label: string, fn: () => Promise<void>) => {
  try {
    await fn();
    console.log(`✅ ${label}`);
  } catch (e) {
    console.error(`❌ ${label}`);
    console.error(e);
    failed = true;
  }
};

await run("shared poseidon + merkle", async () => {
  const r = await $`bun test packages/shared/src/poseidon.test.ts packages/shared/src/encode.test.ts`.cwd(
    ROOT,
  );
  if (r.exitCode !== 0) throw new Error("shared given tests failed");
});

await run("circom Hash2 vector", async () => {
  const r = await $`bun test packages/shared/src/poseidon.circom.test.ts`.cwd(ROOT);
  if (r.exitCode !== 0) throw new Error("circom Hash2 given test failed");
});

await run("shared note encode (not GAP-1)", async () => {
  const r = await $`bun test packages/shared/src/note.test.ts --test-name-pattern "GIVEN"`.cwd(ROOT);
  if (r.exitCode !== 0) throw new Error("note given tests failed");
});

await run("noir hello", async () => {
  await $`nargo test`.cwd(join(ROOT, "circuits/noir/hello"));
});

await run("noir poseidon lib", async () => {
  await $`nargo test`.cwd(join(ROOT, "circuits/noir/lib"));
});

await run("mainnet guard", async () => {
  const r = await $`bun test scripts/mainnet-guard.test.ts`.cwd(ROOT);
  if (r.exitCode !== 0) throw new Error("mainnet guard");
});

await run("cargo verifier + hello-gate + pool hash2", async () => {
  await $`cargo test -p verifier-ultrahonk -p verifier-groth16 -p hello-gate`.cwd(ROOT);
  await $`cargo test -p pool hash2_matches_shared_vector`.cwd(ROOT);
});

if (!givenOnly) {
  console.log("\nGAP tests (failures are fatal in this implementation)\n");
  await run("pool real proof, authorization, replay and rollback", async () => {
    await $`cargo test -p pool`.cwd(ROOT);
  });
  await run("GAP-1 commitment matches vectors", async () => {
    const r = await $`bun test packages/shared/src/note.test.ts --test-name-pattern "GAP-1"`.cwd(
      ROOT,
    ).nothrow();
    if (r.exitCode === 0) console.log("  (green — GAP-1 solved)");
    else throw new Error("GAP acceptance tests failed");
  });
  await run("circuit withdraw tests", async () => {
    const r = await $`bun test packages/shared/src/circuits.gap.test.ts`.cwd(ROOT).nothrow();
    if (r.exitCode === 0) console.log("  (green — GAP-2/2c solved)");
    else throw new Error("GAP acceptance tests failed");
  });
  await run("api + checklist gaps", async () => {
    const r = await $`bun test packages/shared/src/app.gap.test.ts`.cwd(ROOT).nothrow();
    if (r.exitCode === 0) console.log("  (green)");
    else throw new Error("GAP acceptance tests failed");
  });
}

if (failed) process.exit(1);
console.log(givenOnly ? "\n✅ GIVEN tests passed" : "\n✅ GIVEN and selected GAP tests passed (see SOLUTION.md for live evidence)");
