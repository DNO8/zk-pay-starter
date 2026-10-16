# The Poseidon trap

CAP-0075 exposes a **permutation**, not a hash. You supply `field`, `t`, `d`,
`rounds_f`, `rounds_p`, the MDS matrix, and the round constants. The host does
**not** check that those parameters are secure, and it will happily hash with
the wrong constants.

If the circuit, the TypeScript tree, and the contract disagree on any of:

- field (BN254 vs BLS12-381)
- `t` / padding (`state = [0, a, b]` vs `[a, b, 0]`)
- round constants or MDS
- domain tags (`nullifierHash = hash2(n, 1)` vs `hash2(n, 0)`)
- optimized circomlib vs classic permutation

then roots **silently differ** and every withdraw fails, or worse, verifies
against an empty tree.

This repo's single source of truth is `packages/shared/poseidon.params.json`.
Generated copies live in:

- `circuits/noir/lib/src/poseidon_consts.nr`
- `circuits/circom/lib/poseidon_consts.circom`
- `contracts/pool/src/poseidon_params.rs`

Never edit those by hand. Never vendor a second Poseidon. The GIVEN test
`hash2(1,2) matches circomlib` plus `Pool::hash2` against the same vector is
how you know the three languages agree.
