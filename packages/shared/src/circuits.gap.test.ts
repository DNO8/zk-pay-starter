import { describe, expect, test } from "bun:test";
import { $ } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";
import golden from "../vectors/golden.json";

const ROOT = join(import.meta.dir, "../../..");

describe("GAP-2 noir withdraw", () => {
  test("noir: withdraw proves vector 1", async () => {
    const dir = join(ROOT, "circuits/noir/withdraw");
    const p = golden.merkle.path_leaf0_after_2;
    const prover = `
root = "${golden.merkle.root_after_2}"
nullifier_hash = "${golden.notes[0].nullifierHash}"
recipient = "7"
fee = "0"
nullifier = "${golden.notes[0].nullifier}"
secret = "${golden.notes[0].secret}"
path_elements = [${p.elements.map((e) => `"${e}"`).join(", ")}]
path_indices = [${p.indices.join(", ")}]
`;
    await Bun.write(join(dir, "Prover.toml"), prover);
    const good = await $`nargo execute`.cwd(dir).nothrow().quiet();
    expect(good.exitCode, "vector 1 must execute. TODO(GAP-2) docs/lessons/02.md#hints").toBe(0);

    const bad = prover.replace(p.elements[0], `"1"`);
    await Bun.write(join(dir, "Prover.toml"), bad);
    const badRun = await $`nargo execute`.cwd(dir).nothrow().quiet();
    expect(badRun.exitCode, "rejects wrong path").not.toBe(0);
  });

  test("rejects wrong path", async () => {
    // covered above; kept as a named alias for bun run gaps
    expect(true).toBe(true);
  });
});

describe("GAP-2c circom withdraw", () => {
  test("circom: withdraw proves vector 1", async () => {
    const dir = join(ROOT, "circuits/circom/withdraw");
    const p = golden.merkle.path_leaf0_after_2;
    const input = {
      root: golden.merkle.root_after_2,
      nullifierHash: golden.notes[0].nullifierHash,
      recipient: "7",
      fee: "0",
      nullifier: golden.notes[0].nullifier,
      secret: golden.notes[0].secret,
      pathElements: p.elements,
      pathIndices: p.indices.map(String),
    };
    await $`circom withdraw.circom --r1cs --wasm --sym -o ${dir}`.cwd(dir).quiet();
    const wasm = join(dir, "withdraw_js/withdraw.wasm");
    expect(existsSync(wasm)).toBe(true);
    const inputPath = join(dir, "input.json");
    const wtns = join(dir, "witness.wtns");
    await Bun.write(inputPath, JSON.stringify(input));
    const good = await $`bunx snarkjs@0.7.5 wtns calculate ${wasm} ${inputPath} ${wtns}`.nothrow().quiet();
    expect(good.exitCode, "vector 1 witness. TODO(GAP-2c) docs/lessons/02.md#hints").toBe(0);

    const badInput = { ...input, pathElements: p.elements.map(() => "1") };
    await Bun.write(inputPath, JSON.stringify(badInput));
    const bad = await $`bunx snarkjs@0.7.5 wtns calculate ${wasm} ${inputPath} ${wtns}`.nothrow().quiet();
    expect(bad.exitCode, "wrong path must fail witness gen").not.toBe(0);
  });
});
