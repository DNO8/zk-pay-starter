use poseidon_classic::hash2;

global TREE_DEPTH: u32 = 8;
global DOMAIN_NULLIFIER: Field = 1;

/// Public inputs (order is load-bearing - docs/lessons/04.md):
///   0. root
///   1. nullifier_hash
///   2. recipient
///   3. fee
///
/// TODO(GAP-2): withdraw/main.nr: commitment, Merkle membership, nullifierHash, bind recipient/fee
///   - docs/lessons/02.md#hints
fn main(
    root: pub Field,
    nullifier_hash: pub Field,
    recipient: pub Field,
    fee: pub Field,
    nullifier: Field,
    secret: Field,
    path_elements: [Field; 8],
    path_indices: [Field; 8],
) {
    // Skeleton so the circuit compiles. The dummy constraints do not check membership.
    let _ = hash2(0, 0);
    let _ = path_elements;
    let _ = path_indices;
    let _ = nullifier;
    let _ = secret;
    let _ = root;
    let _ = nullifier_hash;
    let _ = recipient;
    let _ = fee;

    // TODO(GAP-2): 1. commitment = hash2(nullifier, secret)
    // TODO(GAP-2): 2. Merkle-walk path_elements/path_indices and assert equals root
    // TODO(GAP-2): 3. assert nullifier_hash == hash2(nullifier, DOMAIN_NULLIFIER)
    // TODO(GAP-2): 4. bind recipient and fee (square them or similar so they cannot be swapped)
}

#[test]
fn withdraw_proves_vector_1() {
    // This test turns green when GAP-2 is solved (vector 1 from packages/shared/vectors/golden.json).
    let root: Field = 2405083059435650308762806090871725478384356217547841505314567986690485505655;
    let nullifier_hash: Field =
        217234377348884654691879377518794323857294947151490278790710809376325639809;
    let recipient: Field = 7;
    let fee: Field = 0;
    let nullifier: Field = 1;
    let secret: Field = 2;
    // path for leaf 0 after two deposits - filled from golden.json
    let path_elements: [Field; 8] = [0; 8];
    let path_indices: [Field; 8] = [0; 8];
    main(
        root,
        nullifier_hash,
        recipient,
        fee,
        nullifier,
        secret,
        path_elements,
        path_indices,
    );
}

#[test]
fn withdraw_rejects_wrong_path() {
    // Must fail (or the circuit must constrain membership) once GAP-2 is solved.
    let root: Field = 2405083059435650308762806090871725478384356217547841505314567986690485505655;
    let nullifier_hash: Field =
        217234377348884654691879377518794323857294947151490278790710809376325639809;
    let path_elements: [Field; 8] = [1, 1, 1, 1, 1, 1, 1, 1];
    let path_indices: [Field; 8] = [0; 8];
    main(root, nullifier_hash, 7, 0, 1, 2, path_elements, path_indices);
}
