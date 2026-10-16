# Unlinkability checklist (GAP-8)

Verified on Stellar Testnet on 2026-10-16T23:08:22.598Z. Receipt: [private-payment.json](../../docs/evidence/private-payment.json).

- [x] Fresh withdrawal address funded independently by Friendbot, never either depositor. [Funding transaction](https://stellar.expert/explorer/testnet/tx/b1ee217c9557cc9228130793305167d91cde08bed04836d6999f675f9810a490).
- [x] At least two deposits from distinct addresses before withdrawal: [deposit A](https://stellar.expert/explorer/testnet/tx/49f2954eb55a265d7d90cd144ce80d6491274651886643d37a0404d567f50888), [deposit C](https://stellar.expert/explorer/testnet/tx/80580129afc2e90926b5addce77d7725669f167d2728d2277a6efc8083681c97).
- [x] Same denomination: 10,000,000 stroops (1 testnet XLM) each.
- [x] [Withdrawal](https://stellar.expert/explorer/testnet/tx/771a8123910dfecdc6779c3c53a51166ae379111ad6ddbebe15fea1dd0cc9b32) supplies a proof, root, nullifier hash, recipient, fee and public relayer address. It does not supply the bearer note, its selected leaf index or its selected commitment. Proof public inputs are exactly root/nullifierHash/recipient/fee. Recipient authorization is public.
- [x] Double spend rejected by live RPC simulation after withdrawal: `Error(Contract, #4)` (NullifierUsed). See `rejections.doubleSpend` in receipt. No failed on-chain transaction is claimed.
- [x] Tampered proof rejected by live RPC simulation before spending: `Error(Contract, #5)` (BadProof). See `rejections.tamperedProof`. No failed on-chain transaction is claimed.

## What still leaks

- Timing: deposit and withdrawal timestamps are visible; close timing enables correlation.
- Anonymity-set size: only two eligible deposits in this integration test, both controlled by the tester; this demonstrates proof mechanics, not anonymity against all observers.
- Funding: all accounts use public Friendbot transactions. Recipient funding is independent of the depositors, but network observers can still see that funding.
- Amount: fixed 1 XLM is visible. Recipient paid the actual network fee of 0.2525112 XLM, so net increase is 0.7474888 XLM.
- Trust: randomized one-party Groth16 development setup, no multiparty ceremony or security audit. The integration prover locally sees a private note. The browser UI generates proofs locally; its full browser execution still requires smoke testing on the deployed URL.
- Domain: never reuse a note in another pool or network; golden commitment/nullifier format contains no pool domain.

Passing this checklist does not complete GAP-7: a real OpenRouter call remains pending secure credential configuration and execution. No mainnet or production-security claim.
