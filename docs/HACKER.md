# Race-day card: land a ZK proof on Stellar testnet

You forked `zk-pay-starter`. This page is the only path you need for the first
30 minutes. **Testnet only. Never mainnet.**

## 0. Fork and clone *your* repo

Do not clone the facilitator repo as a contributor checkout if you want a
submission. Fork on GitHub, then:

```bash
git clone https://github.com/<you>/zk-pay-starter.git
cd zk-pay-starter
```

## 1. Tools (once per laptop)

```bash
./scripts/install-tools.sh    # bun, rustc 1.92, stellar 28.1.0, nargo, bb, circom
# open a new terminal so PATH updates
bun run doctor                # must print protocol ≥ 28 on testnet
```

`doctor` exits non-zero and prints the exact install command for anything missing.

## 2. Deploy the GIVEN pipeline (M0)

```bash
bun install
bun run setup
```

That funds Friendbot keys, builds both verifiers, proves the hello circuit
(`x² = y`) on **Noir + UltraHonk** and **Circom + Groth16**, deploys them to
**Stellar testnet**, and writes `.env`. Takes a few minutes. It must finish green.

## 3. Land the hello proof on-chain (M1)

This is a real `--send yes` transaction. The verifier contract you just
deployed checks the proof.

```bash
bun run verify:hello --path noir --network testnet
```

You should see `✅ hello verified on testnet (noir)` and a
`https://stellar.expert/explorer/testnet/tx/...` link. Open it. That is a
working ZK circuit on Stellar.

Optional second path (same statement, Groth16, cheaper):

```bash
bun run verify:hello --path circom --network testnet
```

Or click through `/debug`:

```bash
bun run dev          # http://127.0.0.1:43121/debug
```

Buttons: fund → prove hello → verify hello. The log is the pipeline.

## 4. Then the race

```bash
bun run gaps         # eight red rows
```

Write `PRD.md` from `PRD.template.md` **before** you spend the shared OpenRouter
key. Paste `CONTEXT.md` into prompts. Read `AGENTS.md`. Hint ladders:
`docs/lessons/`. The hello path is GIVEN. The mixer is yours.

When you shout DEPLOYED, push **your fork** (`main` or a branch on *your* repo)
and have a withdraw-to-fresh-address tx on testnet.
