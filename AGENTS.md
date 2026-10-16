# AGENTS.md

Tutorial monorepo for the Untraceable Payment Race: a private payment on
Stellar **testnet** (never mainnet) with two proving paths.

## Repo map

- `packages/shared` — Poseidon params, Merkle tree, note encode/decode, proof encoders, golden vectors
- `circuits/noir/hello` — GIVEN hello circuit (`x² = y`)
- `circuits/noir/withdraw` — GAP-2 skeleton
- `circuits/circom/hello` — GIVEN hello circuit
- `circuits/circom/withdraw` — GAP-2c skeleton
- `contracts/verifier-ultrahonk` — GIVEN, wraps vendored UltraHonk verifier
- `contracts/verifier-groth16` — GIVEN, BN254 Groth16 (CircomStellar port)
- `contracts/hello-gate` — GIVEN, stores a verified flag
- `contracts/pool` — GAP-3/4/5 skeleton, GIVEN `hash2` + deposit transfer
- `apps/web` — `/debug` GIVEN, `/app` GAP-6
- `apps/api` — OpenRouter stub + Friendbot + prove/verify helpers; GAP-7
- `scripts/` — setup, doctor, deploy, bindings, prove, verify, gaps
- `docs/lessons/` — concepts + 3-step hint ladders
- `vendor/ultrahonk-soroban-verifier` — Nethermind/yugocabrio, MIT OR Apache-2.0

## First-hour path (hackers)

Fork → clone *your* fork → `./scripts/install-tools.sh` → `bun run doctor` →
`bun install && bun run setup` → `bun run verify:hello --path noir --network testnet`.
That last command is a live testnet tx. Details: `docs/HACKER.md`.

## Commands

```
bun run setup         # doctor → build → prove hello both paths → deploy → bindings
bun run doctor        # pin + protocol check
bun run prove:hello --path noir|circom
bun run verify:hello --path noir|circom --network testnet
bun run gaps          # red/green table of TODO(GAP-n)
bun run test          # GIVEN green; GAP reported
bun run dev           # web :43121 + api :43122
bun run tokens        # OpenRouter limit_remaining (read-only)
```

## Golden rules

1. **Testnet only.** `assertNotMainnet` in every network-facing script. Mainnet is disqualification.
2. **Do not edit** `vendor/`, `contracts/verifier-*`, or `packages/shared/vectors/`.
3. **Poseidon** comes only from `packages/shared/poseidon.params.json`.
4. **Public-input order:** `root, nullifierHash, recipient, fee` — docs/lessons/04.md.
5. Run `bun run gaps` after every GAP change.
6. **Explain before you write.** Five bullets of concept + plan, then wait for "go".
7. **Do not complete `TODO(GAP-*)`** unless the user wrote a PRD entry for that gap. Scaffold and explain.
8. Do not vendor `tornado_classic` or Stellar Private Payments. They are reference reading only.

## GIVEN vs GAP

GIVEN must work on a fresh clone: setup, keys, both verifiers, hello prove+verify
on testnet, `/debug`, OpenRouter stub, mainnet guard, GIVEN tests.

GAP (8 items): commitment helpers, withdraw circuits (Noir + Circom), Merkle
insert + root history, nullifier set, public-input wiring, UI, AI step,
unlinkability checklist. Each has a skeleton, a failing named test, and a
hint ladder.

## Pins

See `scripts/pins.ts`. Doctor refuses mismatches.
