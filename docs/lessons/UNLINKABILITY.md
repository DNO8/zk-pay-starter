# Unlinkability checklist (GAP-8)

Fill this in before you shout DEPLOYED. Check a box only when you can point at
a tx hash or a screenshot.

TODO(GAP-8): complete this checklist → docs/lessons/UNLINKABILITY.md

- [ ] Withdrawal goes to a **fresh address** funded by Friendbot (or a relayer),
      never by the depositor. Tx that funded B: `_`
- [ ] The pool had **at least 2 deposits from different addresses** before the
      withdraw. Deposit txs: `_` `_`
- [ ] Every deposit used the **same denomination**. Amount: `_`
- [ ] The withdraw tx reveals only root, nullifier hash, recipient, fee — not
      the commitment, leaf index, or note. Explorer link: `_`
- [ ] Double-spend of the same note is rejected. Error / tx: `_`
- [ ] A tampered proof is rejected live. Error / tx: `_`

## What still leaks (write a sentence each)

- Timing:
- Anonymity-set size:
- Funding of the fresh address:
- Amount (fixed denomination):

When every box is honestly checked, delete the `TODO(GAP-8)` line so
`bun run gaps` can turn this row green.
