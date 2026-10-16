import params from "../poseidon.params.json";
import { Fr } from "./field";

const T = params.t;
const ROUNDS_F = params.rounds_f;
const ROUNDS_P = params.rounds_p;
const N_ROUNDS = ROUNDS_F + ROUNDS_P;
const MDS = params.mds.map((row) => row.map((x) => BigInt(x)));
const RC = params.round_constants.map((row) => row.map((x) => BigInt(x)));

function exp5(a: bigint): bigint {
  const a2 = Fr(a * a);
  return Fr(a * Fr(a2 * a2));
}

/** Classic Poseidon permutation, matching CAP-0075 + circomlib reference. */
export function permute(stateIn: bigint[]): bigint[] {
  if (stateIn.length !== T) {
    throw new Error(`poseidon permute expects t=${T}, got ${stateIn.length}`);
  }
  let S = stateIn.map((x) => Fr(x));
  for (let r = 0; r < N_ROUNDS; r++) {
    for (let j = 0; j < T; j++) S[j] = Fr(S[j] + RC[r][j]);
    const isFull = r < ROUNDS_F / 2 || r >= ROUNDS_F / 2 + ROUNDS_P;
    if (isFull) S = S.map(exp5);
    else S[0] = exp5(S[0]);
    const mixed: bigint[] = [];
    for (let i = 0; i < T; i++) {
      let acc = 0n;
      for (let j = 0; j < T; j++) acc = Fr(acc + Fr(MDS[i][j] * S[j]));
      mixed.push(acc);
    }
    S = mixed;
  }
  return S;
}

/**
 * circomlib Poseidon(2) / Noir hash_2: state = [0, a, b], squeeze state[0].
 * This is the 2-to-1 compression used for Merkle nodes and notes.
 */
export function hash2(a: bigint, b: bigint): bigint {
  return permute([0n, Fr(a), Fr(b)])[0];
}

/**
 * Domain-tagged 1-input hash over the t=3 parameter set:
 * state = [0, x, 0]. Prefer hash2(x, domain) for notes.
 */
export function hash1(x: bigint): bigint {
  return permute([0n, Fr(x), 0n])[0];
}

export const POSEIDON = {
  curve: params.curve,
  field: params.field,
  t: T,
  d: params.d,
  rounds_f: ROUNDS_F,
  rounds_p: ROUNDS_P,
} as const;
