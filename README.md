# zk-pay-starter

Tutorial monorepo for the **Untraceable Payment Race**: in 1–2 hours, with AI
help, take a hello-world ZK proof to a **private payment on Stellar testnet**.

This is a **learning ground, not a solution**. Verifiers and plumbing work out
of the box. The mixer itself (circuit, Merkle insert, nullifiers, UI, AI step)
is left as eight marked gaps.

**Testnet and local only. Never mainnet.**

## Hacker quick start

```bash
bun install
bun run setup          # doctor, keys+Friendbot, build, deploy, bindings
bun run verify:hello --path noir --network testnet
bun run verify:hello --path circom --network testnet
bun run dev            # /debug on http://127.0.0.1:43121
bun run gaps           # what you still have to build
```

Write `PRD.md` from `PRD.template.md` **before** you spend the shared OpenRouter
key. Paste `CONTEXT.md` into prompts. Read `AGENTS.md`.

You need: Rust 1.92, `wasm32v1-none`, Stellar CLI 28.1.0, nargo 1.0.0-beta.9,
bb 0.87.0, circom 2.1.9, bun 1.x. `bun run doctor` prints install commands if
anything is missing.

Two proving paths (both BN254):

| Path | Circuit | Proof | On-chain |
|---|---|---|---|
| Noir | `circuits/noir` | UltraHonk / keccak via bb 0.87.0 | `verifier-ultrahonk` |
| Circom | `circuits/circom` | Groth16 via snarkjs | `verifier-groth16` |

Hello circuit is the toy statement `x² = y`. Withdraw (GAP) is the real
private-payment statement.

## What you build (the gaps)

| Gap | Where | Green test |
|---|---|---|
| GAP-1 | `packages/shared` commitment + nullifierHash | `commitment matches vectors` |
| GAP-2 | Noir `withdraw` | `noir: withdraw proves vector 1` |
| GAP-2c | Circom `withdraw` | `circom: withdraw proves vector 1` |
| GAP-3 | Pool Merkle insert + root history | `insert_matches_shared_root` |
| GAP-4 | Nullifier set | `rejects_reused_nullifier` |
| GAP-5 | Public-input wiring | `withdraw_verifies_vector_proof` |
| GAP-6 | `/app` UI | `app: deposit→withdraw` |
| GAP-7 | OpenRouter in the payment flow | `api: openrouter step logged` |
| GAP-8 | `docs/lessons/UNLINKABILITY.md` | checklist filled |

Hint ladders: `docs/lessons/`. Poseidon trap: `docs/lessons/00-poseidon-trap.md`.

## Facilitator pre-event checklist

- [ ] Testnet RPC up, protocol ≥ 28 (`bun run doctor`)
- [ ] Friendbot funds 15 keys
- [ ] `bun run setup` on two laptops, wall time recorded
- [ ] Noir M1 `--send yes` tx hash
- [ ] Circom M1 tx hash
- [ ] Private `solutions` branch: full withdraw measured with `--cost` (verify-only and withdraw)
- [ ] OpenRouter key limit set; `bun run tokens` works
- [ ] Repo access for every hacker; `CONTEXT.md` linked
- [ ] Spare machines if Docker/Rust installs fail (this repo does not need Docker)

## Pins (verified in this tree)

| Tool | Pin |
|---|---|
| Stellar CLI | 28.1.0 (PRD said 28.0.0; 28.1.0 is the current 28.x with Linux binaries) |
| soroban-sdk | 28.0.0 |
| Rust | 1.92.0, target `wasm32v1-none` |
| nargo | 1.0.0-beta.9 |
| bb | 0.87.0 |
| circom | 2.1.9 |
| snarkjs | 0.7.5 |
| bun | 1.x (box: 1.4.3) |

## Facilitator measurements (hello / M1)

`stellar contract invoke --cost` prints a fee table but **does not print the
instruction count**. Use `simulateTransaction` →
`transactionData.resources.instructions` (budgeted CPU). Testnet
`tx_max_instructions` = 400,000,000.

| Path | Contract | CPU instructions (verify alone) | Live `--send yes` tx |
|---|---|---|---|
| Noir / UltraHonk | `CBXADTHINFTPUVU334XSVXGME6UU4PIAJ4N6XUAD7PPZ6VWSJ43GLTN7` | **78,658,420** | `5a134eef1d746b6fa37be3c11d6c06cd77661c052b8dc3228a09a6629ba68708` |
| Circom / Groth16 | `CANZ2CTJECNHYYK3UDMX6PL7Z4EQV4HOEKNPU45R67X3GJKIQTU5U7OB` | **27,294,181** | `5414fcdd7cfc6cb91831bc0c0462985353ba0fd403cb0d6c301caa71ca35ff95` |

Also deployed: hello-gate `CBEFBAHZFIPCBRUHJTSL7EUEZ3BJW4DC6KTTEFB4Z2LU3LZMGFEWBTIW`,
pool skeleton `CAY56EGUCZM4Q64NHKND6BGQDTXOK4W2FGAR7KA5ODMSJRTVBBDQ5YP3`.
Native XLM SAC on testnet: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`.

Full withdraw CPU (verify + Merkle/nullifier + transfer) is measured on the
private `solutions` branch.

## License

Tutorial code: MIT. Vendored UltraHonk verifier: MIT OR Apache-2.0.
See `CREDITS.md`.
