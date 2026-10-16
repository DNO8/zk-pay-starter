pragma circom 2.1.9;

include "../lib/poseidon_classic.circom";

/// Public: root, nullifierHash, recipient, fee.
/// Private: nullifier, secret, pathElements[8], pathIndices[8].
///
/// TODO(GAP-2c): withdraw.circom, same statement as Noir  → docs/lessons/02.md#hints
template Withdraw(levels) {
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input fee;
    signal input nullifier;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Keep the file compiling. Replace with the real statement.
    component dummy = Hash2();
    dummy.a <== 0;
    dummy.b <== 0;

    signal dummyPub;
    dummyPub <== root * nullifierHash * (recipient + 1) * (fee + 1);
    dummyPub * dummyPub === dummyPub * dummyPub;

    // TODO(GAP-2c): commitment = Hash2(nullifier, secret)
    // TODO(GAP-2c): Merkle membership of commitment under root
    // TODO(GAP-2c): nullifierHash === Hash2(nullifier, 1)
    // TODO(GAP-2c): bind recipient and fee (square them so they cannot be unused)

    signal unusedPath;
    unusedPath <== pathElements[0] + pathIndices[0];
}

component main {public [root, nullifierHash, recipient, fee]} = Withdraw(8);
