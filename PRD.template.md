# PRD: \<name\>              Hacker: \<name\>    2026-10-16
1. Goal: deposit from A, withdraw to fresh B on testnet,
   unlinkable; app calls OpenRouter in the flow.
2. Scope  In: ...   Out: ...
3. Architecture: pool contract · Merkle tree (Poseidon:
   field, t, rounds) · nullifier set · verifier
   (Groth16|UltraHonk) · app (CLI|UI) · OpenRouter step
   (model, purpose) · relayer?
4. Circuit: Circom|Noir. Public: root, nullifierHash,
   recipient, fee. Private: nullifier, secret, path.
5. Interfaces: deposit(commitment) ·
   withdraw(proof, root, nullifier_hash, recipient, fee)
6. Milestones: M1 proves locally · M2 verifier on testnet
   accepts/rejects · M3 2 deposits + withdrawal to fresh
   address · M4 OpenRouter step · M5 SOLUTION.md + push
7. AI budget: tasks for shared key, model size, max calls.
8. What still leaks: timing, small set, funding of B...
