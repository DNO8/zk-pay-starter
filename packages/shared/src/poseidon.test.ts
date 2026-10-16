import { describe, expect, test } from "bun:test";
import golden from "../vectors/golden.json";
import { hash1, hash2, permute } from "./poseidon";
import { MerkleTree, reconstructRoot, zeroHashes } from "./merkle";

describe("GIVEN poseidon", () => {
  test("hash2(1,2) matches circomlib / Noir hash_2 vector", () => {
    expect(hash2(1n, 2n).toString()).toBe(golden.hash2_1_2);
  });

  test("hash2(0,0) is stable", () => {
    expect(hash2(0n, 0n).toString()).toBe(golden.hash2_0_0);
  });

  test("permute([0,0,0]) matches golden", () => {
    expect(permute([0n, 0n, 0n]).map(String)).toEqual(golden.permute_zero);
  });

  test("hash1 is permute([0,x,0])[0]", () => {
    expect(hash1(1n)).toBe(permute([0n, 1n, 0n])[0]);
  });
});

describe("GIVEN merkle", () => {
  test("zero hashes match golden", () => {
    expect(zeroHashes().map(String)).toEqual(golden.zeros);
  });

  test("root after 1 and 2 inserts matches golden", () => {
    const t = new MerkleTree();
    t.insert(BigInt(golden.notes[0].commitment));
    expect(t.root().toString()).toBe(golden.merkle.root_after_1);
    t.insert(BigInt(golden.notes[1].commitment));
    expect(t.root().toString()).toBe(golden.merkle.root_after_2);
  });

  test("proof for leaf 0 reconstructs the root", () => {
    const t = new MerkleTree();
    t.insert(BigInt(golden.notes[0].commitment));
    t.insert(BigInt(golden.notes[1].commitment));
    const p = t.proof(0);
    expect(p.pathElements.map(String)).toEqual(golden.merkle.path_leaf0_after_2.elements);
    expect(p.pathIndices).toEqual(golden.merkle.path_leaf0_after_2.indices);
    expect(reconstructRoot(BigInt(golden.notes[0].commitment), p.pathElements, p.pathIndices)).toBe(
      t.root(),
    );
  });
});
