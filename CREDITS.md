# Credits and licenses

This repo is original tutorial code plus the following MIT (or MIT OR Apache-2.0)
components, used with attribution. We did **not** vendor Nethermind
`tornado_classic` or Stellar Private Payments.

## UltraHonk verifier (vendored)

- `vendor/ultrahonk-soroban-verifier` from
  [NethermindEth/rs-soroban-ultrahonk](https://github.com/NethermindEth/rs-soroban-ultrahonk)
  (origin: [yugocabrio/rs-soroban-ultrahonk](https://github.com/yugocabrio/rs-soroban-ultrahonk)).
- License: MIT OR Apache-2.0 (see `vendor/ultrahonk-soroban-verifier/LICENSE-*`).
- Copyright (c) 2025 Yugo Cabrio, Changmin Cho; 2026 Nethermind.
- Wrapper contract adapted from their `contracts/rs-soroban-ultrahonk`.

## Groth16 verifier (ported, not copied as BLS12-381)

- Flow and contract shape from [jamesbachini/CircomStellar](https://github.com/jamesbachini/CircomStellar)
  (MIT). CircomStellar verifies on **BLS12-381**. This repo reimplements the
  same Groth16 equation on **BN254** via CAP-0074 (`env.crypto().bn254()`).
- Encoder ideas (JSON → uncompressed bytes) adapted from
  `tools/circom_to_soroban_hex`, with G2 ordered `c1||c0` as CAP-0074 requires.

## Setup / deploy pattern

- One-command `bun run setup` + bindings generation follows
  [jamesbachini/Stellar-Game-Studio](https://github.com/jamesbachini/Stellar-Game-Studio)
  (scripts + AGENTS.md style).

## Proving flow

- Noir → bb.js UltraHonk keccak (`--oracle_hash keccak` / `*_ultra_keccak_honk`)
  as documented in [jamesbachini/Noirlang-Experiments](https://github.com/jamesbachini/Noirlang-Experiments)
  and [tupui/ultrahonk_soroban_contract](https://github.com/tupui/ultrahonk_soroban_contract).

## Poseidon constants

- Round constants and MDS for BN254 t=3 from iden3/circomlibjs
  `poseidon_constants.json` (classic/reference permutation), which match
  circomlib `Poseidon(2)` and Noir `hash_2`.
