import golden from "../vectors/golden.json";
import { hash2 } from "./poseidon";
import { Fr } from "./field";

export const TREE_DEPTH = golden.depth as number;

export function zeroHashes(depth = TREE_DEPTH): bigint[] {
  const z = [0n];
  for (let i = 1; i <= depth; i++) z.push(hash2(z[i - 1], z[i - 1]));
  return z;
}

export type MerkleProof = {
  pathElements: bigint[];
  pathIndices: number[];
  root: bigint;
  index: number;
};

/**
 * Incremental Merkle tree of Poseidon(2) hashes. Empty leaves are 0.
 * pathIndices[i] === 0 means the current node is the left child
 * (hash(current, sibling)); 1 means it is the right child.
 */
export class MerkleTree {
  readonly depth: number;
  readonly capacity: number;
  private leaves: bigint[];
  private readonly zeros: bigint[];

  constructor(depth = TREE_DEPTH) {
    this.depth = depth;
    this.capacity = 1 << depth;
    this.leaves = [];
    this.zeros = zeroHashes(depth);
  }

  get nextIndex(): number {
    return this.leaves.length;
  }

  insert(leaf: bigint): number {
    if (this.leaves.length >= this.capacity) throw new Error("tree is full");
    this.leaves.push(Fr(leaf));
    return this.leaves.length - 1;
  }

  root(): bigint {
    return this.rootAt(this.leaves.length);
  }

  rootAt(nLeaves: number): bigint {
    let layer = this.leaves.slice(0, nLeaves).map((x) => Fr(x));
    for (let level = 0; level < this.depth; level++) {
      const next: bigint[] = [];
      const z = this.zeros[level];
      const len = Math.max(1, Math.ceil(layer.length / 2));
      for (let i = 0; i < len; i++) {
        const l = layer[2 * i] ?? z;
        const r = layer[2 * i + 1] ?? z;
        next.push(hash2(l, r));
      }
      // An empty tree hashes zeros all the way up.
      if (next.length === 0) next.push(hash2(z, z));
      layer = next;
    }
    return layer[0];
  }

  proof(index: number): MerkleProof {
    if (index < 0 || index >= this.leaves.length) {
      throw new Error(`no leaf at index ${index}`);
    }
    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    let layer = this.leaves.slice();
    let i = index;
    for (let level = 0; level < this.depth; level++) {
      const isLeft = i % 2 === 0;
      const sibIndex = isLeft ? i + 1 : i - 1;
      const z = this.zeros[level];
      pathElements.push(layer[sibIndex] ?? z);
      pathIndices.push(isLeft ? 0 : 1);
      const next: bigint[] = [];
      for (let j = 0; j < layer.length; j += 2) {
        const l = layer[j] ?? z;
        const r = layer[j + 1] ?? z;
        next.push(hash2(l, r));
      }
      layer = next;
      i = Math.floor(i / 2);
    }
    return { pathElements, pathIndices, root: this.root(), index };
  }
}

export function reconstructRoot(
  leaf: bigint,
  pathElements: bigint[],
  pathIndices: number[],
): bigint {
  let cur = Fr(leaf);
  for (let i = 0; i < pathElements.length; i++) {
    const sib = Fr(pathElements[i]);
    cur = pathIndices[i] === 0 ? hash2(cur, sib) : hash2(sib, cur);
  }
  return cur;
}
