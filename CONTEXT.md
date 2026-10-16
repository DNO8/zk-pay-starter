# CONTEXT.md (paste into prompts)

You are helping a hacker on `zk-pay-starter` (Stellar testnet, never mainnet).

```
note (nullifier, secret)
  → commitment = Poseidon2(nullifier, secret)          # GAP-1
  → deposit into pool Merkle tree (depth 8)            # GAP-3
withdraw proof of:
  Merkle(commitment, path) == root
  nullifierHash = Poseidon2(nullifier, 1)
  bind public recipient, fee                           # GAP-2 / 2c
contract:
  known root? → verify proof → nullifier unused? → pay # GAP-4, GAP-5
```

**Poseidon:** BN254, t=3, d=5, Rf=8, Rp=57, classic permutation, state=`[0,a,b]`,
squeeze `state[0]`. Params: `packages/shared/poseidon.params.json`. TS `hash2`,
Noir `poseidon_classic::hash2`, Circom `Hash2()`, Rust `Pool::hash2` (CAP-0075).

**Public inputs (order):** `root, nullifierHash, recipient, fee`.
UH: N×32 BE. Groth16: u32 BE length || N×32 BE. G1=64, G2=128 (c1||c0).

**Interfaces**

```
deposit(from, commitment) -> index
withdraw(proof, root, nullifier_hash, recipient, fee, relayer)
```

**Paths:** Noir → bb UltraHonk keccak → `verifier-ultrahonk.verify_proof`.
Circom → snarkjs Groth16 BN254 → `verifier-groth16.verify`.

**Milestone:** read `bun run gaps`. Do not edit verifiers or `vectors/`.
Explain in 5 bullets, then wait for "go" before writing GAP code.
