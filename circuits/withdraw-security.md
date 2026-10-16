# Withdrawal statement and security limits

Both circuits use the unchanged BN254 classic Poseidon constants generated from
packages/shared/poseidon.params.json, depth 8, and the ordered public statement:
root, nullifierHash, recipient, fee. Path indices are constrained Boolean. The
witness commits to Poseidon(nullifier, secret); the public spent identifier is
Poseidon(nullifier, 1). A note holder can choose recipient and fee before proving;
a third party cannot alter them on the same proof. The pool additionally checks
canonical fields, known root, fee bounds, recipient address mapping, and replay.

Noir's protected UltraKeccakFlavor verifier is explicitly NON-zero-knowledge.
Its membership correctness tests do not establish witness privacy. Do not use
that backend for the app's private payment claim. The app uses Circom/Groth16.

Run `node scripts/setup-withdraw-groth16.mjs` once to create the Groth16 withdrawal
proving artifacts. It contributes fresh OS randomness to BOTH powers-of-tau and
circuit setup, without placing entropy in logs, arguments, or files. It preserves
an existing final key. This is still a single-machine development setup, not an
audited multiparty ceremony. JavaScript does not guarantee memory erasure. Never
use it for mainnet funds. Changing circuits requires a new reviewed setup and a
new immutable verifier deployment; never silently replace a deployed key.

`proveWithdrawGroth16` in scripts/prove-withdraw.ts uses isolated temporary
witness files with mode 0600, checks the produced public-input order and verifies
the proof, then removes the temporary directory in finally. Never send the note
to AI or third-party proving services. A crash can leave temporary files behind.

`bun run scripts/test-withdraw.ts` generates genuine proofs on both paths and
checks rejection after separately altering every public input. Native Noir tests
and Circom witness tests additionally reject wrong membership, nullifier hash,
and non-Boolean indices. These tests are not an independent cryptographic audit.

Groth16 zero knowledge alone does not eliminate correlation by deposit/withdraw
time, funding source, amount, small anonymity set, or application/network metadata.
