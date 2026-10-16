import { describe, expect, test } from "bun:test";
import { $ } from "bun";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import golden from "../vectors/golden.json";

const CIRCOM_LIB = join(import.meta.dir, "../../../circuits/circom/lib");

describe("GIVEN circom Hash2", () => {
  test("circom Hash2(1,2) matches the shared vector", async () => {
    const out = join(CIRCOM_LIB, "hash2_main_build");
    mkdirSync(out, { recursive: true });
    await $`circom hash2_main.circom --r1cs --wasm --sym -o ${out}`.cwd(CIRCOM_LIB).quiet();
    const wasm = join(out, "hash2_main_js/hash2_main.wasm");
    expect(existsSync(wasm)).toBe(true);
    const inputPath = join(out, "input.json");
    const wtns = join(out, "witness.wtns");
    await Bun.write(inputPath, JSON.stringify({ a: "1", b: "2" }));
    await $`bunx snarkjs@0.7.5 wtns calculate ${wasm} ${inputPath} ${wtns}`.quiet();
    const wtnsJsonPath = join(out, "witness.json");
    await $`bunx snarkjs@0.7.5 wtns export json ${wtns} ${wtnsJsonPath}`.quiet();
    const wtnsJson = (await Bun.file(wtnsJsonPath).json()) as string[];
    // witness[0] = 1 (constant), witness[1] = public output Hash2
    expect(BigInt(wtnsJson[1]).toString()).toBe(golden.hash2_1_2);
  });
});
