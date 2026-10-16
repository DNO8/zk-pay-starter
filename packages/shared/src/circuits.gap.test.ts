import { describe, expect, test } from "bun:test";
import { $ } from "bun";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import golden from "../vectors/golden.json";

const ROOT = join(import.meta.dir, "../../..");
const p = golden.merkle.path_leaf0_after_2, n = golden.notes[0];
const input = {
  root: golden.merkle.root_after_2, nullifierHash: n.nullifierHash, recipient: "7", fee: "0",
  nullifier: n.nullifier, secret: n.secret, pathElements:p.elements, pathIndices:p.indices,
};

describe("GAP-2 noir withdraw", () => {
  test("noir: withdraw proves vector 1 and rejects invalid witnesses", async () => {
    // Native tests call main with proper typed fields, so parser failures cannot satisfy them.
    const result = await $`nargo test`.cwd(join(ROOT,"circuits/noir/withdraw")).quiet().nothrow();
    expect(result.exitCode, result.text()).toBe(0);
    expect(result.text()).toContain("4 tests passed");
  }, 60_000);
});

describe("GAP-2c circom withdraw", () => {
  test("circom: withdraw proves vector 1 and rejects invalid witnesses", async () => {
    const dir=join(ROOT,"circuits/circom/withdraw");
    const temp=await mkdtemp(join(tmpdir(),"withdraw-test-"));
    try {
      await $`circom withdraw.circom --r1cs --wasm --sym -o ${temp}`.cwd(dir).quiet();
      const wasm=join(temp,"withdraw_js/withdraw.wasm"), file=join(temp,"input.json"), wtns=join(temp,"witness.wtns");
      for(const [label, data, valid] of [
        ["valid vector",input,true],
        ["wrong path",{...input,pathElements:p.elements.map(()=>"1")},false],
        ["wrong nullifier hash",{...input,nullifierHash:"1"},false],
        ["wrong root",{...input,root:"1"},false],
        ["nonboolean index",{...input,pathIndices:[2,...p.indices.slice(1)]},false],
      ] as const) {
        await Bun.write(file,JSON.stringify(data));
        const run=await $`bunx snarkjs@0.7.5 wtns calculate ${wasm} ${file} ${wtns}`.quiet().nothrow();
        expect(run.exitCode===0,label).toBe(valid);
        if(!valid) expect(run.text()+run.stderr.toString(),label).toContain("Assert Failed");
      }
    } finally { await rm(temp,{recursive:true,force:true}); }
  },60_000);
});
