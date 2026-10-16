pragma circom 2.1.9;
include "../lib/poseidon_classic.circom";

// Public order must match the pool and proof encoders exactly.
template Withdraw(levels) {
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input fee;
    signal input nullifier;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    component commitment = Hash2();
    commitment.a <== nullifier;
    commitment.b <== secret;
    component spent = Hash2();
    spent.a <== nullifier;
    spent.b <== 1;
    spent.out === nullifierHash;
    signal nodes[levels + 1];
    nodes[0] <== commitment.out;
    component hashes[levels];
    for (var i = 0; i < levels; i++) {
        pathIndices[i] * (pathIndices[i] - 1) === 0;
        hashes[i] = Hash2();
        hashes[i].a <== nodes[i] + pathIndices[i] * (pathElements[i] - nodes[i]);
        hashes[i].b <== pathElements[i] + pathIndices[i] * (nodes[i] - pathElements[i]);
        nodes[i + 1] <== hashes[i].out;
    }
    nodes[levels] === root;
    // Nonlinear constraints retain these public inputs in the Groth16 statement.
    // Their values may be freely chosen BEFORE proving, never swapped afterwards.
    signal recipientSquared;
    signal feeSquared;
    recipientSquared <== recipient * recipient;
    feeSquared <== fee * fee;
}
component main {public [root, nullifierHash, recipient, fee]} = Withdraw(8);
